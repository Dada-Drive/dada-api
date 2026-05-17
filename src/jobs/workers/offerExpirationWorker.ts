import { Job, Worker } from 'bullmq';
import { Transaction } from 'sequelize';

import { config } from '@/config/index';
import { createBullMQConnection } from '@/jobs/connection';
import { Ride, RideOffer, sequelize } from '@/models/index';
import { cacheSet } from '@/services/cacheService';
import * as notificationService from '@/services/notificationService';
import { emitToNearbyDrivers, emitToUser } from '@/sockets/emitter';
import { NotificationType, OfferStatus, RideStatus } from '@/types/enums';
import { validateTransition } from '@/types/rideStateMachine';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OfferExpirationJobData {
  offerId: string;
  rideId: string;
  driverId: string;
  riderId: string;
}

// ── Processor ────────────────────────────────────────────────────────────────

export async function processOfferExpiration(job: Job<OfferExpirationJobData>): Promise<void> {
  const { offerId, rideId, driverId, riderId } = job.data;

  const offer = await RideOffer.findByPk(offerId);
  if (!offer) {
    logger.debug('Offer not found — skipping expiration', { offerId, component: 'jobs' });
    return;
  }

  // Idempotency: only expire if still pending
  if (offer.status !== OfferStatus.Pending) {
    logger.debug('Offer already transitioned — skipping expiration', {
      offerId,
      status: offer.status,
      component: 'jobs',
    });
    return;
  }

  let rideReverted = false;

  await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      // Lock offer row
      const o = await RideOffer.findByPk(offerId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!o || o.status !== OfferStatus.Pending) return;

      o.status = OfferStatus.Expired;
      await o.save({ transaction: t });

      // Check if this was the last pending offer for the ride
      const remainingPending = await RideOffer.count({
        where: { rideId, status: OfferStatus.Pending },
        transaction: t,
      });

      if (remainingPending === 0) {
        // Lock ride and revert to Pending if currently Offered
        const ride = await Ride.findByPk(rideId, { transaction: t, lock: t.LOCK.UPDATE });
        if (ride && ride.status === RideStatus.Offered) {
          validateTransition(ride.status, RideStatus.Pending);
          ride.status = RideStatus.Pending;
          await ride.save({ transaction: t });
          rideReverted = true;
        }
      }
    },
  );

  // Post-transaction: set cooldown, emit events, send notifications
  const cooldownKey = `cooldown:${driverId}:${rideId}`;
  await cacheSet(cooldownKey, '1', config.fare.offerCooldownSeconds);

  // Notify both rider and driver about expired offer
  emitToUser(riderId, 'ride:offer_expired', { rideId, offerId, driverId });
  emitToUser(driverId, 'ride:offer_expired', { rideId, offerId, driverId });

  void notificationService.send(driverId, {
    type: NotificationType.OfferExpired,
    title: 'Offer expired',
    body: 'Your ride offer has expired',
    data: { rideId, offerId },
  });

  // If ride reverted to Pending, re-broadcast to nearby drivers + set secondary timeout
  if (rideReverted) {
    const ride = await Ride.findByPk(rideId);
    if (ride) {
      void emitToNearbyDrivers(
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
          serviceType: ride.serviceType,
          calculatedFare: Number(ride.calculatedFare),
          riderName: '',
        },
        ride.serviceType,
      );

      // Enqueue secondary ride cancellation (2 min)
      const { enqueueRideExpiration } = await import('@/jobs/producers');
      await enqueueRideExpiration({ rideId, riderId }, 2 * 60 * 1000);
    }

    emitToUser(riderId, 'ride:status_changed', {
      rideId,
      status: RideStatus.Pending,
      timestamp: new Date().toISOString(),
    });
  }

  logger.info('Offer expired', {
    offerId,
    rideId,
    driverId,
    rideReverted,
    component: 'jobs',
  });
}

// ── Worker Factory ───────────────────────────────────────────────────────────

export function createOfferExpirationWorker(): Worker<OfferExpirationJobData> {
  const worker = new Worker<OfferExpirationJobData>('offer-expiration', processOfferExpiration, {
    connection: createBullMQConnection(),
    concurrency: 10,
  });

  worker.on('failed', (job, err) => {
    logger.error('Offer expiration job failed', {
      jobId: job?.id,
      offerId: job?.data.offerId,
      attempt: job?.attemptsMade,
      maxAttempts: config.jobs.offerExpiration.attempts,
      error: err.message,
      component: 'jobs',
    });
  });

  return worker;
}
