import request from 'supertest';

import { app } from '@/app';
import { updateDriverLocation } from '@/services/redisGeoService';
import { generateTestToken } from '@/tests/helpers/auth';
import {
  createTestDriverProfile,
  createTestUser,
  createTestVehicle,
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
import { UserRole, VehicleType } from '@/types/enums';

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

describe('Driver Routes', () => {
  describe('POST /api/v1/driver/profile', () => {
    it('creates driver profile', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .post('/api/v1/driver/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          licenseNumber: 'LIC123456',
          licenseExpiry: '2030-12-31',
          cin: 'CIN123456',
          cinDeliveredAt: '2020-01-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.licenseNumber).toBe('LIC123456');
    });

    it('rejects duplicate profile', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      await createTestDriverProfile(user.id);

      const res = await request(app)
        .post('/api/v1/driver/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          licenseNumber: 'LIC999999',
          licenseExpiry: '2030-12-31',
          cin: 'CIN999999',
          cinDeliveredAt: '2020-01-01',
        });

      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).post('/api/v1/driver/profile').send({
        licenseNumber: 'LIC123456',
        licenseExpiry: '2030-12-31',
        cin: 'CIN123456',
        cinDeliveredAt: '2020-01-01',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/driver/profile', () => {
    it('returns driver profile with vehicle', async () => {
      const user = await createTestUser({ role: UserRole.Driver });
      const token = generateTestToken(user.id, user.role);
      const profile = await createTestDriverProfile(user.id);
      await createTestVehicle(profile.id);

      const res = await request(app)
        .get('/api/v1/driver/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.userId).toBe(user.id);
      expect(res.body.data.vehicle).toBeDefined();
    });

    it('returns 404 when no profile exists', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .get('/api/v1/driver/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/driver/vehicle', () => {
    it('registers vehicle for driver', async () => {
      const user = await createTestUser({ role: UserRole.Driver });
      const token = generateTestToken(user.id, user.role);
      await createTestDriverProfile(user.id);

      const res = await request(app)
        .post('/api/v1/driver/vehicle')
        .set('Authorization', `Bearer ${token}`)
        .send({
          make: 'Toyota',
          model: 'Corolla',
          plateNumber: 'TN-1234',
          color: 'White',
          vehicleType: VehicleType.Economy,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.make).toBe('Toyota');
    });
  });

  describe('PATCH /api/v1/driver/status', () => {
    it('rejects status toggle for unapproved driver', async () => {
      const user = await createTestUser({ role: UserRole.Driver });
      const token = generateTestToken(user.id, user.role);
      await createTestDriverProfile(user.id, { isApproved: false });

      const res = await request(app)
        .patch('/api/v1/driver/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ isOnline: true });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/driver/nearby', () => {
    it('returns nearby online drivers', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const profile = await createTestDriverProfile(driver.id, {
        isApproved: true,
        isOnline: true,
        lastLat: 36.8065,
        lastLng: 10.1815,
      });
      await createTestVehicle(profile.id);
      await updateDriverLocation(driver.id, 36.8065, 10.1815, {
        vehicleType: VehicleType.Economy,
        rating: null,
        fullName: driver.fullName,
      });

      const rider = await createTestUser();
      const token = generateTestToken(rider.id, rider.role);

      const res = await request(app)
        .get('/api/v1/driver/nearby')
        .set('Authorization', `Bearer ${token}`)
        .query({ lat: 36.8065, lng: 10.1815, radiusKm: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('excludes offline drivers', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const profile = await createTestDriverProfile(driver.id, {
        isApproved: true,
        isOnline: false,
        lastLat: 36.8065,
        lastLng: 10.1815,
      });
      await createTestVehicle(profile.id);

      const rider = await createTestUser();
      const token = generateTestToken(rider.id, rider.role);

      const res = await request(app)
        .get('/api/v1/driver/nearby')
        .set('Authorization', `Bearer ${token}`)
        .query({ lat: 36.8065, lng: 10.1815, radiusKm: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });
});
