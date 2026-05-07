import { Queue } from 'bullmq';

import { getSharedConnection } from '@/jobs/connection';

// ── Queue Definitions ───────────────────────────────────────────────────────

const notificationQueue = new Queue('notification', {
  connection: getSharedConnection(),
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
});

const paymentVerificationQueue = new Queue('payment-verification', {
  connection: getSharedConnection(),
  defaultJobOptions: { removeOnComplete: 50, removeOnFail: 1000 },
});

const rideExpirationQueue = new Queue('ride-expiration', {
  connection: getSharedConnection(),
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 200 },
});

const scheduledRideActivationQueue = new Queue('scheduled-ride-activation', {
  connection: getSharedConnection(),
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 200 },
});

const otpDeliveryQueue = new Queue('otp-delivery', {
  connection: getSharedConnection(),
  defaultJobOptions: { removeOnComplete: 50, removeOnFail: 200 },
});

const ratingRecalculationQueue = new Queue('rating-recalculation', {
  connection: getSharedConnection(),
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 200 },
});

const allQueues = [
  notificationQueue,
  paymentVerificationQueue,
  rideExpirationQueue,
  scheduledRideActivationQueue,
  otpDeliveryQueue,
  ratingRecalculationQueue,
];

export {
  allQueues,
  notificationQueue,
  otpDeliveryQueue,
  paymentVerificationQueue,
  ratingRecalculationQueue,
  rideExpirationQueue,
  scheduledRideActivationQueue,
};
