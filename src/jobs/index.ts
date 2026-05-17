import { closeSharedConnection, getSharedConnection } from '@/jobs/connection';
import { allQueues } from '@/jobs/queues';
import { createNotificationWorker } from '@/jobs/workers/notificationWorker';
import { createOfferExpirationWorker } from '@/jobs/workers/offerExpirationWorker';
import { createOtpDeliveryWorker } from '@/jobs/workers/otpDeliveryWorker';
import { createPaymentVerificationWorker } from '@/jobs/workers/paymentVerificationWorker';
import { createRatingRecalculationWorker } from '@/jobs/workers/ratingRecalculationWorker';
import { createRideExpirationWorker } from '@/jobs/workers/rideExpirationWorker';
import { createScheduledRideActivationWorker } from '@/jobs/workers/scheduledRideActivationWorker';
import { logger } from '@/utils/logger';

// ── State ────────────────────────────────────────────────────────────────────

const allWorkers: { close: () => Promise<void> }[] = [];

// ── Lifecycle ────────────────────────────────────────────────────────────────

async function initializeJobSystem(): Promise<void> {
  const connection = getSharedConnection();
  if (connection.status !== 'ready' && connection.status !== 'connecting') {
    await connection.connect();
  }

  allWorkers.push(
    createNotificationWorker(),
    createOfferExpirationWorker(),
    createPaymentVerificationWorker(),
    createRideExpirationWorker(),
    createScheduledRideActivationWorker(),
    createOtpDeliveryWorker(),
    createRatingRecalculationWorker(),
  );

  logger.info('Job system initialized', {
    queues: allQueues.length,
    workers: allWorkers.length,
    component: 'jobs',
  });
}

async function shutdownJobSystem(): Promise<void> {
  // Close workers first — drains in-progress jobs
  await Promise.all(allWorkers.map((w) => w.close()));

  // Close queues
  await Promise.all(allQueues.map((q) => q.close()));

  // Close shared connection
  await closeSharedConnection();

  logger.info('Job system shut down gracefully', { component: 'jobs' });
}

export { allQueues, initializeJobSystem, shutdownJobSystem };
