import request from 'supertest';

import { app } from '@/app';
import { generateTestToken } from '@/tests/helpers/auth';
import {
  createTestDriverProfile,
  createTestRating,
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

jest.mock('@/services/notificationService', () => ({
  send: jest.fn().mockResolvedValue(undefined),
}));

// Mock job producers — rating recalculation is now async
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

describe('Rating Routes', () => {
  describe('POST /api/v1/ratings/rides/:rideId', () => {
    it('submits rating for a completed ride', async () => {
      const rider = await createTestUser();
      const driver = await createTestUser({ role: UserRole.Driver });
      await createTestDriverProfile(driver.id);
      const ride = await createTestRide(rider.id, {
        driverId: driver.id,
        status: RideStatus.Completed,
      });
      const token = generateTestToken(rider.id, rider.role);

      const res = await request(app)
        .post(`/api/v1/ratings/rides/${ride.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 5, comment: 'Great ride!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.score).toBe(5);
    });

    it('rejects duplicate rating', async () => {
      const rider = await createTestUser();
      const driver = await createTestUser({ role: UserRole.Driver });
      await createTestDriverProfile(driver.id);
      const ride = await createTestRide(rider.id, {
        driverId: driver.id,
        status: RideStatus.Completed,
      });
      await createTestRating(ride.id, rider.id, driver.id);
      const token = generateTestToken(rider.id, rider.role);

      const res = await request(app)
        .post(`/api/v1/ratings/rides/${ride.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 4 });

      expect(res.status).toBe(409);
    });

    it('rejects rating for non-completed ride', async () => {
      const rider = await createTestUser();
      const driver = await createTestUser({ role: UserRole.Driver });
      const ride = await createTestRide(rider.id, {
        driverId: driver.id,
        status: RideStatus.InProgress,
      });
      const token = generateTestToken(rider.id, rider.role);

      const res = await request(app)
        .post(`/api/v1/ratings/rides/${ride.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 5 });

      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/v1/ratings/rides/00000000-0000-0000-0000-000000000000')
        .send({ score: 5 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/ratings/rides/:rideId', () => {
    it('returns ride rating', async () => {
      const rider = await createTestUser();
      const driver = await createTestUser({ role: UserRole.Driver });
      const ride = await createTestRide(rider.id, {
        driverId: driver.id,
        status: RideStatus.Completed,
      });
      await createTestRating(ride.id, rider.id, driver.id, { score: 4, comment: 'Nice' });
      const token = generateTestToken(rider.id, rider.role);

      const res = await request(app)
        .get(`/api/v1/ratings/rides/${ride.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBe(4);
    });

    it('returns 404 for unrated ride', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      const ride = await createTestRide(user.id);

      const res = await request(app)
        .get(`/api/v1/ratings/rides/${ride.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/ratings/drivers/:driverId', () => {
    it('returns paginated driver ratings', async () => {
      const rider = await createTestUser();
      const driver = await createTestUser({ role: UserRole.Driver });
      const ride1 = await createTestRide(rider.id, {
        driverId: driver.id,
        status: RideStatus.Completed,
      });
      const ride2 = await createTestRide(rider.id, {
        driverId: driver.id,
        status: RideStatus.Completed,
      });
      await createTestRating(ride1.id, rider.id, driver.id, { score: 5 });
      await createTestRating(ride2.id, rider.id, driver.id, { score: 3 });
      const token = generateTestToken(rider.id, rider.role);

      const res = await request(app)
        .get(`/api/v1/ratings/drivers/${driver.id}`)
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });
  });
});
