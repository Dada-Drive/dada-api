import request from 'supertest';

import { app } from '@/app';
import { generateTestToken } from '@/tests/helpers/auth';
import {
  createTestDriverProfile,
  createTestRide,
  createTestUser,
  createTestWallet,
  createTestWalletTransaction,
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
import { UserRole } from '@/types/enums';

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

describe('Admin Routes', () => {
  describe('GET /api/v1/admin/stats', () => {
    it('returns platform stats for admin', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      await createTestUser();
      await createTestUser();

      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(3);
    });

    it('rejects non-admin user', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/admin/stats');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('returns paginated user list', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      await createTestUser();
      await createTestUser();

      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.meta).toBeDefined();
    });
  });

  describe('GET /api/v1/admin/users/:userId', () => {
    it('returns user details', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      const user = await createTestUser();

      const res = await request(app)
        .get(`/api/v1/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(user.id);
    });

    it('returns 404 for non-existent user', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);

      const res = await request(app)
        .get('/api/v1/admin/users/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/admin/users/:userId/deactivate', () => {
    it('deactivates a user', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      const user = await createTestUser();

      const res = await request(app)
        .patch(`/api/v1/admin/users/${user.id}/deactivate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('PATCH /api/v1/admin/users/:userId/activate', () => {
    it('activates a user', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      const user = await createTestUser({ isActive: false });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${user.id}/activate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });
  });

  describe('PATCH /api/v1/admin/drivers/:userId/approve', () => {
    it('approves a driver', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      const user = await createTestUser({ role: UserRole.Pending });
      await createTestDriverProfile(user.id, { isApproved: false });

      const res = await request(app)
        .patch(`/api/v1/admin/drivers/${user.id}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isApproved).toBe(true);
    });
  });

  describe('GET /api/v1/admin/drivers/pending', () => {
    it('returns pending drivers', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      const user = await createTestUser({ role: UserRole.Pending });
      await createTestDriverProfile(user.id, { isApproved: false });

      const res = await request(app)
        .get('/api/v1/admin/drivers/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /api/v1/admin/rides', () => {
    it('returns paginated rides', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      const user = await createTestUser();
      await createTestRide(user.id);

      const res = await request(app)
        .get('/api/v1/admin/rides')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta).toBeDefined();
    });
  });

  describe('GET /api/v1/admin/transactions', () => {
    it('returns paginated transactions', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const token = generateTestToken(admin.id, admin.role);
      const user = await createTestUser();
      await createTestWallet(user.id);
      await createTestWalletTransaction(user.id);

      const res = await request(app)
        .get('/api/v1/admin/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta).toBeDefined();
    });
  });
});
