import request from 'supertest';

import { app } from '@/app';
import { generateTestToken } from '@/tests/helpers/auth';
import {
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

describe('Wallet Routes', () => {
  describe('GET /api/v1/wallet', () => {
    it('returns wallet balance', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      await createTestWallet(user.id, 150);

      const res = await request(app).get('/api/v1/wallet').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.balance)).toBe(150);
    });

    it('returns 404 when no wallet exists', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app).get('/api/v1/wallet').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/wallet');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/wallet/transactions', () => {
    it('returns paginated transactions', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      await createTestWallet(user.id);
      await createTestWalletTransaction(user.id);
      await createTestWalletTransaction(user.id);

      const res = await request(app)
        .get('/api/v1/wallet/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/v1/wallet/topup/online', () => {
    it('initiates online topup', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      await createTestWallet(user.id);

      const res = await request(app)
        .post('/api/v1/wallet/topup/online')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 50 });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
      expect(Number(res.body.data.amount)).toBe(50);
    });
  });

  describe('POST /api/v1/wallet/topup/manual', () => {
    it('admin performs manual topup', async () => {
      const admin = await createTestUser({ role: UserRole.Admin });
      const adminToken = generateTestToken(admin.id, admin.role);
      const user = await createTestUser();
      await createTestWallet(user.id, 100);

      const res = await request(app)
        .post('/api/v1/wallet/topup/manual')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: user.id, amount: 200 });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('completed');
    });

    it('rejects non-admin user', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);
      const target = await createTestUser();
      await createTestWallet(target.id);

      const res = await request(app)
        .post('/api/v1/wallet/topup/manual')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: target.id, amount: 100 });

      expect(res.status).toBe(403);
    });
  });
});
