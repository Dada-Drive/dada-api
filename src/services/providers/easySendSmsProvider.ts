import { config } from '@/config/index';
import { logger } from '@/utils/logger';

const EASYSENDSMS_API_URL = 'https://www.easysendsms.com/sms/bulksms-api/bulksms-api';
const TIMEOUT_MS = 5000;

async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const { apiKey, sender } = config.easySendSms;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      username: apiKey,
      password: apiKey,
      from: sender,
      to: phone,
      text: `Your DADA verification code is: ${code}. It expires in 5 minutes.`,
      type: '0',
    });

    const response = await fetch(`${EASYSENDSMS_API_URL}?${params.toString()}`, {
      method: 'GET',
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
