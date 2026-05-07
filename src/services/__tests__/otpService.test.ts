import nock from 'nock';

import { OtpCode } from '@/models/index';
import { sendOtp, verifyOtp } from '@/services/otpService';
import { createTestOtp, resetFactoryCounters } from '@/tests/helpers/factories';
import {
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
  flushTestRedis,
} from '@/tests/setup';

// Mock job producers — OTP delivery is now async
jest.mock('@/jobs/producers', () => ({
  enqueueOtpDelivery: jest.fn().mockResolvedValue(undefined),
}));

beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
});

afterAll(async () => {
  nock.cleanAll();
  nock.restore();
  await teardownTestDatabase();
  await teardownTestRedis();
});

beforeEach(async () => {
  await truncateAllTables();
  await flushTestRedis();
  resetFactoryCounters();
  nock.cleanAll();
});

describe('otpService', () => {
  describe('sendOtp', () => {
    it('generates, stores, and enqueues delivery', async () => {
      const result = await sendOtp('+21650001111');

      expect(result.otpId).toBeDefined();
      expect(result.channel).toBe('whatsapp');
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify OTP stored in DB
      const otp = await OtpCode.findByPk(result.otpId);
      expect(otp).not.toBeNull();
      expect(otp!.phone).toBe('+21650001111');
      expect(otp!.isUsed).toBe(false);
      expect(otp!.attempts).toBe(0);
    });

    it('returns whatsapp channel (delivery is async via job queue)', async () => {
      const result = await sendOtp('+21650001112');

      // Delivery is now handled by otpDeliveryWorker — sendOtp returns immediately
      expect(result.channel).toBe('whatsapp');
    });

    it('invalidates previous OTPs for same phone', async () => {
      await sendOtp('+21650001113');
      await sendOtp('+21650001113');

      // Only the latest OTP should be unused
      const otps = await OtpCode.findAll({
        where: { phone: '+21650001113', isUsed: false },
      });
      expect(otps.length).toBe(1);
    });
  });

  describe('verifyOtp', () => {
    it('succeeds with correct code', async () => {
      await createTestOtp('+21650002222', '654321');

      await expect(verifyOtp('+21650002222', '654321')).resolves.toBeUndefined();

      // Verify marked as used
      const otp = await OtpCode.findOne({
        where: { phone: '+21650002222' },
        order: [['createdAt', 'DESC']],
      });
      expect(otp!.isUsed).toBe(true);
    });

    it('rejects wrong code and increments attempts', async () => {
      await createTestOtp('+21650002223', '654321');

      await expect(verifyOtp('+21650002223', '000000')).rejects.toThrow(
        expect.objectContaining({ code: 'OTP_INVALID' }),
      );

      // Check attempts incremented
      const otp = await OtpCode.findOne({
        where: { phone: '+21650002223' },
        order: [['createdAt', 'DESC']],
      });
      expect(otp!.attempts).toBe(1);
    });

    it('rejects after max attempts exceeded', async () => {
      await createTestOtp('+21650002224', '654321', { attempts: 3 });

      await expect(verifyOtp('+21650002224', '654321')).rejects.toThrow(
        expect.objectContaining({ code: 'OTP_MAX_ATTEMPTS' }),
      );
    });

    it('rejects expired OTP', async () => {
      await createTestOtp('+21650002225', '654321', { expiresInMinutes: -1 });

      await expect(verifyOtp('+21650002225', '654321')).rejects.toThrow(
        expect.objectContaining({ code: 'OTP_EXPIRED' }),
      );
    });
  });
});
