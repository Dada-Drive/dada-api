import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { Op } from 'sequelize';

import { config } from '@/config/index';
import { redisClient } from '@/config/redis';
import { enqueueOtpDelivery } from '@/jobs/producers';
import { OtpCode } from '@/models/index';
import { appError, ErrorCodes } from '@/types/errorCodes';

// ── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

// ── Rate Limiting (Redis) ────────────────────────────────────────────────────

async function checkOtpRateLimit(phone: string): Promise<void> {
  const { maxPerPhonePerHour, maxGlobalPerMinute } = config.otp;

  // Per-phone limit
  const phoneKey = `otp:phone:${phone}`;
  const phoneCount = await redisClient.incr(phoneKey);
  if (phoneCount === 1) {
    await redisClient.expire(phoneKey, 3600);
  }
  if (phoneCount > maxPerPhonePerHour) {
    throw appError(ErrorCodes.OTP.OTP_RATE_LIMITED, { phone });
  }

  // Global limit
  const minuteBucket = Math.floor(Date.now() / 60000);
  const globalKey = `otp:global:${String(minuteBucket)}`;
  const globalCount = await redisClient.incr(globalKey);
  if (globalCount === 1) {
    await redisClient.expire(globalKey, 60);
  }
  if (globalCount > maxGlobalPerMinute) {
    throw appError(ErrorCodes.OTP.OTP_RATE_LIMITED);
  }
}

// ── Send OTP ─────────────────────────────────────────────────────────────────

interface SendOtpResult {
  otpId: string;
  channel: 'whatsapp' | 'sms';
  expiresAt: Date;
}

async function sendOtp(phone: string): Promise<SendOtpResult> {
  // 1. Check rate limits
  await checkOtpRateLimit(phone);

  // 2. Generate 6-digit code
  const code = String(crypto.randomInt(100000, 999999));

  // 3. Hash the code
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);

  // 4. Invalidate any existing unused OTPs for this phone
  await OtpCode.update(
    { isUsed: true },
    {
      where: {
        phone,
        isUsed: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    },
  );

  // 5. Store new OTP
  const expiresAt = new Date(Date.now() + config.otp.expiresInMinutes * 60 * 1000);
  const otpRecord = await OtpCode.create({ phone, codeHash, expiresAt });

  // 6. Enqueue delivery — non-blocking (WhatsApp first, SMS fallback handled by worker)
  void enqueueOtpDelivery({
    otpId: otpRecord.id,
    phone,
    code,
    channel: 'whatsapp',
  });

  return { otpId: otpRecord.id, channel: 'whatsapp', expiresAt };
}

// ── Verify OTP ───────────────────────────────────────────────────────────────

async function verifyOtp(phone: string, code: string): Promise<void> {
  // Find most recent unused, non-expired OTP
  const otpRecord = await OtpCode.findOne({
    where: {
      phone,
      isUsed: false,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
  });

  if (!otpRecord) {
    throw appError(ErrorCodes.OTP.OTP_EXPIRED);
  }

  // Check max attempts
  if (otpRecord.attempts >= config.otp.maxAttempts) {
    throw appError(ErrorCodes.OTP.OTP_MAX_ATTEMPTS);
  }

  // Increment attempts
  await otpRecord.update({ attempts: otpRecord.attempts + 1 });

  // Compare
  const isValid = await bcrypt.compare(code, otpRecord.codeHash);

  if (!isValid) {
    if (otpRecord.attempts + 1 >= config.otp.maxAttempts) {
      throw appError(ErrorCodes.OTP.OTP_MAX_ATTEMPTS);
    }
    throw appError(ErrorCodes.OTP.OTP_INVALID);
  }

  // Mark as used
  await otpRecord.update({ isUsed: true });
}

export { sendOtp, verifyOtp };
export type { SendOtpResult };
