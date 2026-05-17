import { Job } from 'bullmq';

import { DriverProfile, Rating } from '@/models/index';
import {
  createTestDriverProfile,
  createTestRide,
  createTestUser,
  resetFactoryCounters,
} from '@/tests/helpers/factories';
import {
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
} from '@/tests/setup';
import { RideStatus, UserRole } from '@/types/enums';

import { processRatingRecalculation } from '../workers/ratingRecalculationWorker';

import type { RatingRecalculationJobData } from '../workers/ratingRecalculationWorker';

// Mock socket emitter
jest.mock('@/sockets/emitter', () => ({
  emitToRideRoom: jest.fn(),
  emitToUser: jest.fn(),
  emitToNearbyDrivers: jest.fn().mockResolvedValue(undefined),
  joinRideRoom: jest.fn().mockResolvedValue(undefined),
  leaveRideRoom: jest.fn().mockResolvedValue(undefined),
}));

// Mock job producers
jest.mock('@/jobs/producers', () => ({
  enqueueRideExpiration: jest.fn().mockResolvedValue(undefined),
  enqueueScheduledRideActivation: jest.fn().mockResolvedValue(undefined),
  cancelRideExpiration: jest.fn().mockResolvedValue(undefined),
  cancelOfferExpiration: jest.fn().mockResolvedValue(undefined),
  enqueueOfferExpiration: jest.fn().mockResolvedValue(undefined),
  cancelScheduledRideActivation: jest.fn().mockResolvedValue(undefined),
  enqueueNotification: jest.fn().mockResolvedValue(undefined),
  enqueueOtpDelivery: jest.fn().mockResolvedValue(undefined),
  enqueuePaymentVerification: jest.fn().mockResolvedValue(undefined),
  enqueueRatingRecalculation: jest.fn().mockResolvedValue(undefined),
}));

beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
});

afterAll(async () => {
  await teardownTestDatabase();
  await teardownTestRedis();
});

beforeEach(async () => {
  await truncateAllTables();
  await flushTestRedis();
  resetFactoryCounters();
});

function makeJob(data: RatingRecalculationJobData): Job<RatingRecalculationJobData> {
  return { data } as unknown as Job<RatingRecalculationJobData>;
}

describe('ratingRecalculationWorker', () => {
  it('recalculates driver rating from all ratings', async () => {
    const rider = await createTestUser({ role: UserRole.Rider });
    const driver = await createTestUser({ role: UserRole.Driver });
    await createTestDriverProfile(driver.id);

    // Create completed rides with ratings
    const ride1 = await createTestRide(rider.id, {
      status: RideStatus.Completed,
      driverId: driver.id,
    });
    const ride2 = await createTestRide(rider.id, {
      status: RideStatus.Completed,
      driverId: driver.id,
    });

    await Rating.create({ rideId: ride1.id, riderId: rider.id, driverId: driver.id, score: 4 });
    await Rating.create({ rideId: ride2.id, riderId: rider.id, driverId: driver.id, score: 5 });

    const job = makeJob({ driverId: driver.id, triggeredBy: 'rating_submit' });
    await processRatingRecalculation(job);

    const profile = await DriverProfile.findOne({ where: { userId: driver.id } });
    expect(Number(profile!.rating)).toBe(4.5);
  });

  it('is idempotent — multiple runs produce same result', async () => {
    const rider = await createTestUser({ role: UserRole.Rider });
    const driver = await createTestUser({ role: UserRole.Driver });
    await createTestDriverProfile(driver.id);

    const ride = await createTestRide(rider.id, {
      status: RideStatus.Completed,
      driverId: driver.id,
    });
    await Rating.create({ rideId: ride.id, riderId: rider.id, driverId: driver.id, score: 3 });

    const job = makeJob({ driverId: driver.id, triggeredBy: 'rating_submit' });

    await processRatingRecalculation(job);
    await processRatingRecalculation(job);

    const profile = await DriverProfile.findOne({ where: { userId: driver.id } });
    expect(Number(profile!.rating)).toBe(3);
  });

  it('skips when no ratings exist for driver', async () => {
    const driver = await createTestUser({ role: UserRole.Driver });
    await createTestDriverProfile(driver.id);

    const job = makeJob({ driverId: driver.id, triggeredBy: 'rating_submit' });

    // Should not throw
    await processRatingRecalculation(job);

    const profile = await DriverProfile.findOne({ where: { userId: driver.id } });
    // Rating unchanged (initial value)
    expect(profile!.rating).toBeDefined();
  });
});
