import request from 'supertest';

import { app } from '@/app';
import { generateTestToken } from '@/tests/helpers/auth';
import { createTestUser, resetFactoryCounters } from '@/tests/helpers/factories';
import {
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
} from '@/tests/setup';

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

describe('User Routes', () => {
  describe('GET /api/v1/users/me', () => {
    it('returns user profile', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(user.id);
      expect(res.body.data.fullName).toBeDefined();
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/users/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('updates profile fields', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Updated Name');
    });
  });

  describe('PATCH /api/v1/users/me/phone', () => {
    it('rejects duplicate phone', async () => {
      await createTestUser({ phone: '+21650000001' });
      const user2 = await createTestUser({ phone: '+21650000002' });
      const token = generateTestToken(user2.id, user2.role);

      const res = await request(app)
        .patch('/api/v1/users/me/phone')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+21650000001' });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/v1/users/me', () => {
    it('deactivates account', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });
});
