import { Job } from 'bullmq';

import { Ride, RideOffer } from '@/models/index';
import {
  createTestRide,
  createTestRideOffer,
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
import { OfferStatus, RideStatus, UserRole } from '@/types/enums';

import { processRideExpiration } from '../workers/rideExpirationWorker';

import type { RideExpirationJobData } from '../workers/rideExpirationWorker';

// Mock socket emitter
jest.mock('@/sockets/emitter', () => ({
  emitToRideRoom: jest.fn(),
  emitToUser: jest.fn(),
  emitToNearbyDrivers: jest.fn().mockResolvedValue(undefined),
  joinRideRoom: jest.fn().mockResolvedValue(undefined),
  leaveRideRoom: jest.fn().mockResolvedValue(undefined),
}));

// Mock job producers (avoid circular dependency from scheduledRideActivationWorker)
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

function makeJob(data: RideExpirationJobData): Job<RideExpirationJobData> {
  return { data } as unknown as Job<RideExpirationJobData>;
}

describe('rideExpirationWorker', () => {
  it('cancels a pending ride and expires its offers', async () => {
    const rider = await createTestUser({ role: UserRole.Rider });
    const driver = await createTestUser({ role: UserRole.Driver });
    const ride = await createTestRide(rider.id);
    await createTestRideOffer(ride.id, driver.id);

    const job = makeJob({ rideId: ride.id, riderId: rider.id });
    await processRideExpiration(job);

    const updated = await Ride.findByPk(ride.id);
    expect(updated!.status).toBe(RideStatus.Cancelled);
    expect(updated!.cancelledBy).toBe('system');
    expect(updated!.cancelReason).toContain('Expired');

    const offers = await RideOffer.findAll({ where: { rideId: ride.id } });
    expect(offers.every((o) => o.status === OfferStatus.Expired)).toBe(true);
  });

  it('is idempotent — skips already-accepted rides', async () => {
    const rider = await createTestUser({ role: UserRole.Rider });
    const ride = await createTestRide(rider.id, { status: RideStatus.Accepted });

    const job = makeJob({ rideId: ride.id, riderId: rider.id });
    await processRideExpiration(job);

    const unchanged = await Ride.findByPk(ride.id);
    expect(unchanged!.status).toBe(RideStatus.Accepted);
  });

  it('is idempotent — skips non-existent rides', async () => {
    const job = makeJob({
      rideId: '00000000-0000-4000-a000-999999999999',
      riderId: '00000000-0000-4000-a000-999999999998',
    });

    // Should not throw
    await processRideExpiration(job);
  });

  it('cancels an offered ride', async () => {
    const rider = await createTestUser({ role: UserRole.Rider });
    const ride = await createTestRide(rider.id, { status: RideStatus.Offered });

    const job = makeJob({ rideId: ride.id, riderId: rider.id });
    await processRideExpiration(job);

    const updated = await Ride.findByPk(ride.id);
    expect(updated!.status).toBe(RideStatus.Cancelled);
  });
});
