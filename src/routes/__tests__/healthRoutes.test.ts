import request from 'supertest';

import { app } from '@/app';
import {
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
} from '@/tests/setup';

jest.mock('@/config/firebase', () => ({
  getFirebaseApp: jest.fn(() => ({})),
  getMessaging: jest.fn(),
}));

jest.mock('@/jobs/producers', () => ({
  enqueueNotification: jest.fn().mockResolvedValue(undefined),
  enqueueOtpDelivery: jest.fn().mockResolvedValue(undefined),
  enqueuePaymentVerification: jest.fn().mockResolvedValue(undefined),
  enqueueRideExpiration: jest.fn().mockResolvedValue(undefined),
  enqueueScheduledRideActivation: jest.fn().mockResolvedValue(undefined),
  cancelRideExpiration: jest.fn().mockResolvedValue(undefined),
  cancelOfferExpiration: jest.fn().mockResolvedValue(undefined),
  enqueueOfferExpiration: jest.fn().mockResolvedValue(undefined),
  cancelScheduledRideActivation: jest.fn().mockResolvedValue(undefined),
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

describe('Health Routes', () => {
  describe('GET /api/v1/health', () => {
    it('returns 200 with healthy status when all dependencies are up', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.version).toBeDefined();
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.checks.database.status).toBe('healthy');
      expect(res.body.checks.database.latency).toBeDefined();
      expect(res.body.checks.redis.status).toBe('healthy');
      expect(res.body.checks.redis.latency).toBeDefined();
      expect(res.body.checks.firebase.status).toBe('healthy');
    });

    it('returns 503 when Redis is down', async () => {
      const redis = await import('@/config/redis');
      const originalPingRedis = redis.pingRedis;
      jest.spyOn(redis, 'pingRedis').mockResolvedValue(false);

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
      expect(res.body.checks.redis.status).toBe('unhealthy');
      expect(res.body.checks.database.status).toBe('healthy');

      (redis.pingRedis as jest.Mock).mockImplementation(originalPingRedis);
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('returns 200 with ready status when all dependencies are up', async () => {
      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });

    it('returns 503 when a dependency is down', async () => {
      const redis = await import('@/config/redis');
      jest.spyOn(redis, 'pingRedis').mockResolvedValue(false);

      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');

      (redis.pingRedis as jest.Mock).mockRestore();
    });
  });

  describe('GET /api/v1/health/live', () => {
    it('always returns 200 with alive status', async () => {
      const res = await request(app).get('/api/v1/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
    });
  });
});
