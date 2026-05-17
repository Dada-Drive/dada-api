import { Job, Worker } from 'bullmq';

import { config } from '@/config/index';
import { createBullMQConnection } from '@/jobs/connection';
import { Ride } from '@/models/index';
import { emitToNearbyDrivers, emitToUser } from '@/sockets/emitter';
import { RideStatus } from '@/types/enums';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledRideActivationJobData {
  rideId: string;
  riderId: string;
  scheduledAt: string; // ISO date
}

// ── Processor ────────────────────────────────────────────────────────────────

export async function processScheduledRideActivation(
  job: Job<ScheduledRideActivationJobData>,
): Promise<void> {
  const { rideId, riderId } = job.data;

  const ride = await Ride.findByPk(rideId);
  if (!ride) {
    logger.debug('Scheduled ride not found — skipping activation', { rideId, component: 'jobs' });
    return;
  }

  // Idempotency: only activate if still pending
  if (ride.status !== RideStatus.Pending) {
    logger.debug('Scheduled ride already transitioned — skipping activation', {
      rideId,
      status: ride.status,
      component: 'jobs',
    });
    return;
  }

  // Notify nearby drivers about this ride becoming active
  await emitToNearbyDrivers(
    ride.pickupLat,
    ride.pickupLng,
    config.socket.rideSearchRadiusKm,
    'ride:new_request',
    {
      rideId: ride.id,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      vehicleType: ride.vehicleType,
      calculatedFare: ride.calculatedFare,
    },
    ride.serviceType,
  );

  // Notify rider that their scheduled ride is now active
  emitToUser(riderId, 'ride:status_changed', {
    rideId,
    status: RideStatus.Pending,
    timestamp: new Date().toISOString(),
  });

  // Enqueue expiration for this now-active ride (5-min window)
  // Import dynamically to avoid circular dependency
  const { enqueueRideExpiration } = await import('@/jobs/producers');
  await enqueueRideExpiration({ rideId, riderId }, 5 * 60 * 1000);

  logger.info('Scheduled ride activated', { rideId, riderId, component: 'jobs' });
}

// ── Worker Factory ───────────────────────────────────────────────────────────

export function createScheduledRideActivationWorker(): Worker<ScheduledRideActivationJobData> {
  const worker = new Worker<ScheduledRideActivationJobData>(
    'scheduled-ride-activation',
    processScheduledRideActivation,
    {
      connection: createBullMQConnection(),
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Scheduled ride activation job failed', {
      jobId: job?.id,
      rideId: job?.data.rideId,
      attempt: job?.attemptsMade,
      maxAttempts: config.jobs.scheduledRideActivation.attempts,
      error: err.message,
      component: 'jobs',
    });
  });

  return worker;
}
