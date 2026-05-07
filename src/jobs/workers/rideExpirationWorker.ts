import { Job, Worker } from 'bullmq';
import { Transaction } from 'sequelize';

import { config } from '@/config/index';
import { createBullMQConnection } from '@/jobs/connection';
import { Ride, RideOffer, sequelize } from '@/models/index';
import * as notificationService from '@/services/notificationService';
import { emitToRideRoom, emitToUser } from '@/sockets/emitter';
import { NotificationType, OfferStatus, RideStatus } from '@/types/enums';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RideExpirationJobData {
  rideId: string;
  riderId: string;
}

// ── Processor ────────────────────────────────────────────────────────────────

export async function processRideExpiration(job: Job<RideExpirationJobData>): Promise<void> {
  const { rideId, riderId } = job.data;

  const ride = await Ride.findByPk(rideId);
  if (!ride) {
    logger.debug('Ride not found — skipping expiration', { rideId, component: 'jobs' });
    return;
  }

  // Idempotency: only cancel if still in expirable state
  if (ride.status !== RideStatus.Pending && ride.status !== RideStatus.Offered) {
    logger.debug('Ride already transitioned — skipping expiration', {
      rideId,
      status: ride.status,
      component: 'jobs',
    });
    return;
  }

  await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      // Re-fetch with lock to prevent race
      const r = await Ride.findByPk(rideId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!r || (r.status !== RideStatus.Pending && r.status !== RideStatus.Offered)) {
        return;
      }

      r.status = RideStatus.Cancelled;
      r.cancelledBy = 'system';
      r.cancelReason = 'Expired — no driver accepted';
      await r.save({ transaction: t });

      // Reject all pending offers
      await RideOffer.update(
        { status: OfferStatus.Expired },
        { where: { rideId, status: OfferStatus.Pending }, transaction: t },
      );
    },
  );

  // Emit after transaction commit
  emitToRideRoom(rideId, 'ride:cancelled', {
    rideId,
    cancelledBy: 'system',
    cancelReason: 'Expired — no driver accepted',
  });

  emitToUser(riderId, 'ride:cancelled', {
    rideId,
    cancelledBy: 'system',
    cancelReason: 'Expired — no driver accepted',
  });

  void notificationService.send(riderId, {
    type: NotificationType.RideExpired,
    title: 'Ride expired',
    body: 'Your ride request expired — no driver accepted in time',
    data: { rideId },
  });

  logger.info('Ride expired and auto-cancelled', { rideId, riderId, component: 'jobs' });
}

// ── Worker Factory ───────────────────────────────────────────────────────────

export function createRideExpirationWorker(): Worker<RideExpirationJobData> {
  const worker = new Worker<RideExpirationJobData>('ride-expiration', processRideExpiration, {
    connection: createBullMQConnection(),
    concurrency: 10,
  });

  worker.on('failed', (job, err) => {
    logger.error('Ride expiration job failed', {
      jobId: job?.id,
      rideId: job?.data.rideId,
      attempt: job?.attemptsMade,
      maxAttempts: config.jobs.rideExpiration.attempts,
      error: err.message,
      component: 'jobs',
    });
  });

  return worker;
}
