import { Job, Worker } from 'bullmq';

import { config } from '@/config/index';
import { createBullMQConnection } from '@/jobs/connection';
import { sendSmsOtp } from '@/services/providers/easySendSmsProvider';
import { sendWhatsAppOtp } from '@/services/providers/vonageWhatsappProvider';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OtpDeliveryJobData {
  otpId: string;
  phone: string;
  code: string;
  channel: 'whatsapp' | 'sms';
}

// ── Processor ────────────────────────────────────────────────────────────────

export async function processOtpDelivery(job: Job<OtpDeliveryJobData>): Promise<void> {
  const { phone, code, channel, otpId } = job.data;

  if (channel === 'whatsapp') {
    try {
      await sendWhatsAppOtp(phone, code);
      logger.info('OTP delivered via WhatsApp', { otpId, phone, component: 'jobs' });
      return;
    } catch (err) {
      logger.warn('WhatsApp OTP delivery failed — falling back to SMS', {
        otpId,
        phone,
        error: err instanceof Error ? err.message : String(err),
        component: 'jobs',
      });
      // Fall through to SMS
    }
  }

  // SMS delivery (direct attempt or WhatsApp fallback)
  await sendSmsOtp(phone, code);
  logger.info('OTP delivered via SMS', { otpId, phone, component: 'jobs' });
}

// ── Worker Factory ───────────────────────────────────────────────────────────

export function createOtpDeliveryWorker(): Worker<OtpDeliveryJobData> {
  const worker = new Worker<OtpDeliveryJobData>('otp-delivery', processOtpDelivery, {
    connection: createBullMQConnection(),
    concurrency: 10,
  });

  worker.on('failed', (job, err) => {
    logger.error('OTP delivery job failed', {
      jobId: job?.id,
      otpId: job?.data.otpId,
      phone: job?.data.phone,
      channel: job?.data.channel,
      attempt: job?.attemptsMade,
      maxAttempts: config.jobs.otpDelivery.attempts,
      error: err.message,
      component: 'jobs',
    });
  });

  return worker;
}
