import {
  cancelRideExpiration,
  enqueueNotification,
  enqueueOtpDelivery,
  enqueuePaymentVerification,
  enqueueRatingRecalculation,
  enqueueRideExpiration,
  enqueueScheduledRideActivation,
} from '../producers';
import {
  notificationQueue,
  otpDeliveryQueue,
  paymentVerificationQueue,
  ratingRecalculationQueue,
  rideExpirationQueue,
  scheduledRideActivationQueue,
} from '../queues';

// Mock queue.add and queue.getJob
jest.mock('../queues', () => {
  const mockAdd = jest.fn().mockResolvedValue({ id: 'mock-job-id' });
  const mockGetJob = jest.fn();
  const makeQueue = (name: string) => ({
    name,
    add: mockAdd,
    getJob: mockGetJob,
  });
  return {
    notificationQueue: makeQueue('notification'),
    paymentVerificationQueue: makeQueue('payment-verification'),
    rideExpirationQueue: makeQueue('ride-expiration'),
    scheduledRideActivationQueue: makeQueue('scheduled-ride-activation'),
    otpDeliveryQueue: makeQueue('otp-delivery'),
    ratingRecalculationQueue: makeQueue('rating-recalculation'),
    allQueues: [],
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('producers', () => {
  describe('enqueueNotification', () => {
    it('adds job with correct payload', async () => {
      await enqueueNotification({
        userId: 'user-1',
        title: 'Ride Update',
        body: 'Your driver is arriving',
      });

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send-push',
        { userId: 'user-1', title: 'Ride Update', body: 'Your driver is arriving' },
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('enqueuePaymentVerification', () => {
    it('adds job with dedup jobId', async () => {
      await enqueuePaymentVerification({
        transactionId: 'tx-1',
        userId: 'user-1',
        flouciPaymentId: 'flouci-1',
      });

      expect(paymentVerificationQueue.add).toHaveBeenCalledWith(
        'verify',
        { transactionId: 'tx-1', userId: 'user-1', flouciPaymentId: 'flouci-1' },
        expect.objectContaining({ jobId: 'payment-tx-1', attempts: 5 }),
      );
    });
  });

  describe('enqueueRideExpiration', () => {
    it('adds delayed job with correct delay', async () => {
      await enqueueRideExpiration({ rideId: 'ride-1', riderId: 'rider-1' }, 300000);

      expect(rideExpirationQueue.add).toHaveBeenCalledWith(
        'expire',
        { rideId: 'ride-1', riderId: 'rider-1' },
        expect.objectContaining({ jobId: 'expire-ride-1', delay: 300000 }),
      );
    });

    it('clamps negative delay to 0', async () => {
      await enqueueRideExpiration({ rideId: 'ride-2', riderId: 'rider-2' }, -1000);

      expect(rideExpirationQueue.add).toHaveBeenCalledWith(
        'expire',
        expect.anything(),
        expect.objectContaining({ delay: 0 }),
      );
    });
  });

  describe('enqueueScheduledRideActivation', () => {
    it('adds delayed activation job', async () => {
      await enqueueScheduledRideActivation(
        { rideId: 'ride-3', riderId: 'rider-3', scheduledAt: '2026-05-08T10:00:00Z' },
        900000,
      );

      expect(scheduledRideActivationQueue.add).toHaveBeenCalledWith(
        'activate',
        { rideId: 'ride-3', riderId: 'rider-3', scheduledAt: '2026-05-08T10:00:00Z' },
        expect.objectContaining({ jobId: 'schedule-ride-3', delay: 900000 }),
      );
    });
  });

  describe('enqueueOtpDelivery', () => {
    it('adds job with otpId-based jobId', async () => {
      await enqueueOtpDelivery({
        otpId: 'otp-1',
        phone: '+21650000001',
        code: '123456',
        channel: 'whatsapp',
      });

      expect(otpDeliveryQueue.add).toHaveBeenCalledWith(
        'deliver',
        { otpId: 'otp-1', phone: '+21650000001', code: '123456', channel: 'whatsapp' },
        expect.objectContaining({ jobId: 'otp-otp-1' }),
      );
    });
  });

  describe('enqueueRatingRecalculation', () => {
    it('adds debounced job with 5s delay', async () => {
      await enqueueRatingRecalculation({
        driverId: 'driver-1',
        triggeredBy: 'rating_submit',
      });

      expect(ratingRecalculationQueue.add).toHaveBeenCalledWith(
        'recalculate',
        { driverId: 'driver-1', triggeredBy: 'rating_submit' },
        expect.objectContaining({ jobId: 'rating-driver-1', delay: 5000 }),
      );
    });
  });

  describe('cancelRideExpiration', () => {
    it('removes delayed job if it exists', async () => {
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      (rideExpirationQueue.getJob as jest.Mock).mockResolvedValue({
        isDelayed: jest.fn().mockResolvedValue(true),
        remove: mockRemove,
      });

      await cancelRideExpiration('ride-1');

      expect(rideExpirationQueue.getJob).toHaveBeenCalledWith('expire-ride-1');
      expect(mockRemove).toHaveBeenCalled();
    });

    it('does nothing if job does not exist', async () => {
      (rideExpirationQueue.getJob as jest.Mock).mockResolvedValue(null);

      await cancelRideExpiration('ride-2');
      // No error thrown
    });

    it('does nothing if job is not in delayed state', async () => {
      const mockRemove = jest.fn();
      (rideExpirationQueue.getJob as jest.Mock).mockResolvedValue({
        isDelayed: jest.fn().mockResolvedValue(false),
        remove: mockRemove,
      });

      await cancelRideExpiration('ride-3');
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });
});
