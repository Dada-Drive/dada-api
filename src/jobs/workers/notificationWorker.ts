import { Job, Worker } from 'bullmq';

import { getMessaging } from '@/config/firebase';
import { config } from '@/config/index';
import { captureNonFatal } from '@/config/sentry';
import { createBullMQConnection } from '@/jobs/connection';
import { DeviceToken } from '@/models/index';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotificationJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

// ── Processor ────────────────────────────────────────────────────────────────

export async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { userId, title, body, data, imageUrl } = job.data;

  const tokens = await DeviceToken.findAll({ where: { userId } });
  if (tokens.length === 0) {
    logger.debug('No device tokens for user — skipping notification', {
      userId,
      component: 'jobs',
    });
    return;
  }

  const messaging = getMessaging();
  const invalidTokenIds: string[] = [];

  for (const deviceToken of tokens) {
    try {
      await messaging.send({
        token: deviceToken.token,
        notification: { title, body, ...(imageUrl && { imageUrl }) },
        ...(data && { data }),
      });
    } catch (err: unknown) {
      const errorCode = (err as { code?: string }).code;
      if (
        errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token'
      ) {
        invalidTokenIds.push(deviceToken.id);
      } else {
        logger.warn('FCM send failed for token', {
          userId,
          tokenId: deviceToken.id,
          error: err instanceof Error ? err.message : String(err),
          component: 'jobs',
        });
        captureNonFatal(err, { userId, tokenId: deviceToken.id, type: 'fcm_delivery_failure' });
        throw err;
      }
    }
  }

  if (invalidTokenIds.length > 0) {
    await DeviceToken.destroy({ where: { id: invalidTokenIds } });
    logger.info('Removed invalid device tokens', {
      userId,
      count: invalidTokenIds.length,
      component: 'jobs',
    });
  }
}

// ── Worker Factory ───────────────────────────────────────────────────────────

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>('notification', processNotification, {
    connection: createBullMQConnection(),
    concurrency: 5,
    limiter: { max: 50, duration: 1000 },
  });

  worker.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job?.id,
      userId: job?.data.userId,
      attempt: job?.attemptsMade,
      maxAttempts: config.jobs.notification.attempts,
      error: err.message,
      component: 'jobs',
    });
  });

  return worker;
}
