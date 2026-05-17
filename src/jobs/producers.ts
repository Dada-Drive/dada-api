import { config } from '@/config/index';
import {
  notificationQueue,
  offerExpirationQueue,
  otpDeliveryQueue,
  paymentVerificationQueue,
  ratingRecalculationQueue,
  rideExpirationQueue,
  scheduledRideActivationQueue,
} from '@/jobs/queues';
import { logger } from '@/utils/logger';

import type { NotificationJobData } from './workers/notificationWorker';
import type { OfferExpirationJobData } from './workers/offerExpirationWorker';
import type { OtpDeliveryJobData } from './workers/otpDeliveryWorker';
import type { PaymentVerificationJobData } from './workers/paymentVerificationWorker';
import type { RatingRecalculationJobData } from './workers/ratingRecalculationWorker';
import type { RideExpirationJobData } from './workers/rideExpirationWorker';
import type { ScheduledRideActivationJobData } from './workers/scheduledRideActivationWorker';

// ── Producer Functions ───────────────────────────────────────────────────────
// Thin helpers that services call to enqueue jobs.
// All guard with try/catch — enqueue failures log errors but never crash the caller.

async function enqueueNotification(data: NotificationJobData): Promise<void> {
  try {
    await notificationQueue.add('send-push', data, {
      attempts: config.jobs.notification.attempts,
      backoff: config.jobs.notification.backoff,
    });
  } catch (err) {
    logger.error('Failed to enqueue notification', {
      userId: data.userId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function enqueuePaymentVerification(data: PaymentVerificationJobData): Promise<void> {
  try {
    await paymentVerificationQueue.add('verify', data, {
      jobId: `payment-${data.transactionId}`,
      attempts: config.jobs.paymentVerification.attempts,
      backoff: config.jobs.paymentVerification.backoff,
    });
  } catch (err) {
    logger.error('Failed to enqueue payment verification', {
      transactionId: data.transactionId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function enqueueRideExpiration(data: RideExpirationJobData, delayMs: number): Promise<void> {
  try {
    await rideExpirationQueue.add('expire', data, {
      jobId: `expire-${data.rideId}`,
      delay: Math.max(0, delayMs),
      attempts: config.jobs.rideExpiration.attempts,
      backoff: config.jobs.rideExpiration.backoff,
    });
  } catch (err) {
    logger.error('Failed to enqueue ride expiration', {
      rideId: data.rideId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function enqueueScheduledRideActivation(
  data: ScheduledRideActivationJobData,
  delayMs: number,
): Promise<void> {
  try {
    await scheduledRideActivationQueue.add('activate', data, {
      jobId: `schedule-${data.rideId}`,
      delay: Math.max(0, delayMs),
      attempts: config.jobs.scheduledRideActivation.attempts,
      backoff: config.jobs.scheduledRideActivation.backoff,
    });
  } catch (err) {
    logger.error('Failed to enqueue scheduled ride activation', {
      rideId: data.rideId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function enqueueOtpDelivery(data: OtpDeliveryJobData): Promise<void> {
  try {
    await otpDeliveryQueue.add('deliver', data, {
      jobId: `otp-${data.otpId}`,
      attempts: config.jobs.otpDelivery.attempts,
      backoff: config.jobs.otpDelivery.backoff,
    });
  } catch (err) {
    logger.error('Failed to enqueue OTP delivery', {
      otpId: data.otpId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function enqueueRatingRecalculation(data: RatingRecalculationJobData): Promise<void> {
  try {
    await ratingRecalculationQueue.add('recalculate', data, {
      jobId: `rating-${data.driverId}`,
      delay: 5000, // debounce: rapid ratings collapse into one job
      attempts: config.jobs.ratingRecalculation.attempts,
      backoff: config.jobs.ratingRecalculation.backoff,
    });
  } catch (err) {
    logger.error('Failed to enqueue rating recalculation', {
      driverId: data.driverId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function enqueueOfferExpiration(
  data: OfferExpirationJobData,
  delayMs: number,
): Promise<void> {
  try {
    await offerExpirationQueue.add('expire-offer', data, {
      jobId: `offer-expire-${data.offerId}`,
      delay: Math.max(0, delayMs),
      attempts: config.jobs.offerExpiration.attempts,
      backoff: config.jobs.offerExpiration.backoff,
    });
  } catch (err) {
    logger.error('Failed to enqueue offer expiration', {
      offerId: data.offerId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function cancelOfferExpiration(offerId: string): Promise<void> {
  try {
    const job = await offerExpirationQueue.getJob(`offer-expire-${offerId}`);
    if (job && (await job.isDelayed())) {
      await job.remove();
    }
  } catch (err) {
    logger.error('Failed to cancel offer expiration job', {
      offerId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function cancelRideExpiration(rideId: string): Promise<void> {
  try {
    const job = await rideExpirationQueue.getJob(`expire-${rideId}`);
    if (job && (await job.isDelayed())) {
      await job.remove();
    }
  } catch (err) {
    logger.error('Failed to cancel ride expiration job', {
      rideId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

async function cancelScheduledRideActivation(rideId: string): Promise<void> {
  try {
    const job = await scheduledRideActivationQueue.getJob(`schedule-${rideId}`);
    if (job && (await job.isDelayed())) {
      await job.remove();
    }
  } catch (err) {
    logger.error('Failed to cancel scheduled ride activation job', {
      rideId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jobs',
    });
  }
}

export {
  cancelOfferExpiration,
  cancelRideExpiration,
  cancelScheduledRideActivation,
  enqueueNotification,
  enqueueOfferExpiration,
  enqueueOtpDelivery,
  enqueuePaymentVerification,
  enqueueRatingRecalculation,
  enqueueRideExpiration,
  enqueueScheduledRideActivation,
};
