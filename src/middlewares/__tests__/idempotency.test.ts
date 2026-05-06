import request from 'supertest';

import { app } from '@/app';
import { Wallet } from '@/models/index';
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
import { TransactionStatus, TransactionType } from '@/types/enums';

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

describe('Idempotency Middleware', () => {
  it('returns cached response on same Idempotency-Key', async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id, user.role);
    await createTestWallet(user.id, 0);
    const tx = await createTestWalletTransaction(user.id, {
      type: TransactionType.TopupOnline,
      amount: 50,
      status: TransactionStatus.Pending,
    });

    const key = 'test-key-001';

    // First request — should process normally
    const res1 = await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ transactionId: tx.id });

    expect(res1.status).toBe(200);

    // Second request — should return cached response
    const res2 = await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ transactionId: tx.id });

    expect(res2.status).toBe(200);
    expect(res2.body).toEqual(res1.body);

    // Wallet credited only once
    const wallet = await Wallet.findOne({ where: { ownerId: user.id } });
    expect(Number(wallet!.balance)).toBe(50);
  });

  it('processes different Idempotency-Keys independently', async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id, user.role);
    await createTestWallet(user.id, 0);
    const tx = await createTestWalletTransaction(user.id, {
      type: TransactionType.TopupOnline,
      amount: 50,
      status: TransactionStatus.Pending,
    });

    const res1 = await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'key-A')
      .send({ transactionId: tx.id });

    expect(res1.status).toBe(200);

    // Different key — processes fresh (tx already completed, so idempotent return)
    const res2 = await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'key-B')
      .send({ transactionId: tx.id });

    expect(res2.status).toBe(200);
  });

  it('passes through without Idempotency-Key header', async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id, user.role);
    await createTestWallet(user.id, 0);
    const tx = await createTestWalletTransaction(user.id, {
      type: TransactionType.TopupOnline,
      amount: 50,
      status: TransactionStatus.Pending,
    });

    const res = await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionId: tx.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
