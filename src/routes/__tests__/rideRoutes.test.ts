import request from 'supertest';

import { app } from '@/app';
import { generateTestToken } from '@/tests/helpers/auth';
import { createTestRide, createTestUser, resetFactoryCounters } from '@/tests/helpers/factories';
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

jest.mock('@/jobs/producers', () => ({
  enqueueRideExpiration: jest.fn().mockResolvedValue(undefined),
  enqueueScheduledRideActivation: jest.fn().mockResolvedValue(undefined),
  cancelRideExpiration: jest.fn().mockResolvedValue(undefined),
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

describe('Ride Routes', () => {
  describe('GET /api/v1/rides/fare', () => {
    it('returns fare estimate', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .get('/api/v1/rides/fare')
        .set('Authorization', `Bearer ${token}`)
        .query({ vehicleType: 'economy', distanceKm: 10, estimatedMinutes: 20 });

      expect(res.status).toBe(200);
      expect(res.body.data.fare).toBeDefined();
      expect(res.body.data.currency).toBe('TND');
    });

    it('rejects missing parameters', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .get('/api/v1/rides/fare')
        .set('Authorization', `Bearer ${token}`)
        .query({ vehicleType: 'economy' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/rides', () => {
    it('creates a ride', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleType: 'economy',
          pickupLat: 36.8065,
          pickupLng: 10.1815,
          pickupAddress: 'Tunis Centre',
          dropoffLat: 36.8265,
          dropoffLng: 10.2015,
          dropoffAddress: 'La Marsa',
          distanceKm: 5.0,
          estimatedMinutes: 15,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(RideStatus.Pending);
      expect(res.body.data.calculatedFare).toBeDefined();
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).post('/api/v1/rides').send({
        vehicleType: 'economy',
        pickupLat: 36.8065,
        pickupLng: 10.1815,
        pickupAddress: 'Tunis',
        dropoffLat: 36.8265,
        dropoffLng: 10.2015,
        dropoffAddress: 'La Marsa',
        distanceKm: 5.0,
        estimatedMinutes: 15,
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/rides/my', () => {
    it('returns paginated rides for user', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      await createTestRide(user.id);
      await createTestRide(user.id);

      const res = await request(app)
        .get('/api/v1/rides/my')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('GET /api/v1/rides/:id', () => {
    it('returns ride details', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      const ride = await createTestRide(user.id);

      const res = await request(app)
        .get(`/api/v1/rides/${ride.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(ride.id);
    });

    it('returns 404 for non-existent ride', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .get('/api/v1/rides/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/rides/:id/accept', () => {
    it('driver creates an offer for a pending ride', async () => {
      const rider = await createTestUser();
      const driver = await createTestUser({ role: UserRole.Driver });
      const token = generateTestToken(driver.id, driver.role);
      const ride = await createTestRide(rider.id, { status: RideStatus.Pending });

      const res = await request(app)
        .post(`/api/v1/rides/${ride.id}/accept`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ride.status).toBe(RideStatus.Offered);
      expect(res.body.data.offer.driverId).toBe(driver.id);
    });

    it('rejects accepting a completed ride', async () => {
      const rider = await createTestUser();
      const driver = await createTestUser({ role: UserRole.Driver });
      const token = generateTestToken(driver.id, driver.role);
      const ride = await createTestRide(rider.id, { status: RideStatus.Completed });

      const res = await request(app)
        .post(`/api/v1/rides/${ride.id}/accept`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/rides/:id/cancel', () => {
    it('cancels a pending ride', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      const ride = await createTestRide(user.id, { status: RideStatus.Pending });

      const res = await request(app)
        .patch(`/api/v1/rides/${ride.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Changed my mind' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(RideStatus.Cancelled);
    });

    it('rejects cancelling a completed ride', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      const ride = await createTestRide(user.id, { status: RideStatus.Completed });

      const res = await request(app)
        .patch(`/api/v1/rides/${ride.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
