import { config } from '@/config/index';
import { logger } from '@/utils/logger';

const VONAGE_API_URL = 'https://messages-sandbox.nexmo.com/v1/messages';
const TIMEOUT_MS = 3000;

async function sendWhatsAppOtp(phone: string, code: string): Promise<void> {
  const { apiKey, apiSecret, whatsappFrom } = config.vonage;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(VONAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        message_type: 'text',
        text: `Your DADA verification code is: ${code}. It expires in 5 minutes.`,
        to: phone,
        from: whatsappFrom,
        channel: 'whatsapp',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vonage WhatsApp API error: ${String(response.status)} — ${body}`);
    }

    logger.info('OTP sent via WhatsApp', {
      phone: phone.slice(-4),
      component: 'otp',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export { sendWhatsAppOtp };
