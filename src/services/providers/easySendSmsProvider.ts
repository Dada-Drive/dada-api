import { config } from '@/config/index';
import { logger } from '@/utils/logger';

const EASYSENDSMS_API_URL = 'https://api.easysendsms.app/bulksms';
const TIMEOUT_MS = 5000;

async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const { username, password, sender } = config.easySendSms;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Strip leading '+' or '00' — EasySend expects raw digits
    const cleanPhone = phone.replace(/^\+|^00/, '');

    const params = new URLSearchParams({
      username,
      password,
      from: sender,
      to: cleanPhone,
      text: `Your DADA verification code is: ${code}. It expires in 5 minutes.`,
      type: '0',
    });

    const response = await fetch(EASYSENDSMS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`EasySendSMS API error: ${String(response.status)} — ${body}`);
    }

    logger.info('OTP sent via SMS', {
      phone: phone.slice(-4),
      component: 'otp',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export { sendSmsOtp };
