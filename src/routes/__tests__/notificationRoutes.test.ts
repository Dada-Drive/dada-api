import request from 'supertest';

import { app } from '@/app';
import { generateTestToken } from '@/tests/helpers/auth';
import {
  createTestDeviceToken,
  createTestNotification,
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
import { DevicePlatform } from '@/types/enums';

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

describe('Notification Routes', () => {
  // ── GET / ─────────────────────────────────────────────────────────────────

  describe('GET /api/v1/notifications', () => {
    it('returns paginated notifications', async () => {
      const user = await createTestUser();
      await createTestNotification(user.id, { title: 'N1' });
      await createTestNotification(user.id, { title: 'N2' });
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /unread-count ─────────────────────────────────────────────────────

  describe('GET /api/v1/notifications/unread-count', () => {
    it('returns unread count', async () => {
      const user = await createTestUser();
      await createTestNotification(user.id);
      await createTestNotification(user.id);
      await createTestNotification(user.id, { isRead: true });
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });
  });

  // ── PATCH /:id/read ───────────────────────────────────────────────────────

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('marks notification as read', async () => {
      const user = await createTestUser();
      const notif = await createTestNotification(user.id);
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .patch(`/api/v1/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });

    it('returns 404 for non-existent notification', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .patch('/api/v1/notifications/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 403 for notification owned by another user', async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const notif = await createTestNotification(owner.id);
      const token = generateTestToken(other.id, other.role);

      const res = await request(app)
        .patch(`/api/v1/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /read-all ────────────────────────────────────────────────────────

  describe('POST /api/v1/notifications/read-all', () => {
    it('marks all unread as read and returns count', async () => {
      const user = await createTestUser();
      await createTestNotification(user.id);
      await createTestNotification(user.id);
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2);
    });
  });

  // ── PUT /token ────────────────────────────────────────────────────────────

  describe('PUT /api/v1/notifications/token', () => {
    it('refreshes device token', async () => {
      const user = await createTestUser();
      await createTestDeviceToken(user.id, { token: 'old-token' });
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .put('/api/v1/notifications/token')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldToken: 'old-token', newToken: 'new-token' });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBe('new-token');
    });

    it('returns 400 for missing fields', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .put('/api/v1/notifications/token')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldToken: 'old-token' });

      expect(res.status).toBe(400);
    });
  });

  // ── Existing token endpoints (regression) ────────────────────────────────

  describe('POST /api/v1/notifications/token', () => {
    it('registers a device token', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .post('/api/v1/notifications/token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'fcm-token-123', platform: DevicePlatform.Android });

      expect(res.status).toBe(201);
      expect(res.body.data.token).toBe('fcm-token-123');
    });
  });

  describe('DELETE /api/v1/notifications/token', () => {
    it('unregisters a device token', async () => {
      const user = await createTestUser();
      await createTestDeviceToken(user.id, { token: 'remove-me' });
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .delete('/api/v1/notifications/token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'remove-me' });

      expect(res.status).toBe(204);
    });
  });
});
