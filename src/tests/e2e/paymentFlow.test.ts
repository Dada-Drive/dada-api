jest.mock('@/services/notificationService', () => ({
  send: jest.fn().mockResolvedValue(undefined),
}));

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

jest.mock('@/config/firebase', () => ({
  getFirebaseApp: jest.fn(),
}));

import { randomUUID } from 'crypto';

import request from 'supertest';

import { app } from '@/app';
import { resetFactoryCounters } from '@/tests/helpers/factories';
import {
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
} from '@/tests/setup';

import { registerAndLogin, resetE2eCounters } from './e2eHelpers';

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
  resetE2eCounters();
});

describe('Payment E2E Flow', () => {
  it('completes topup lifecycle: initiate, confirm, balance updated', async () => {
    const user = await registerAndLogin();

    // 1. Verify initial balance is 0
    const initialWallet = await request(app)
      .get('/api/v1/wallet')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(initialWallet.status).toBe(200);
    expect(Number(initialWallet.body.data.balance)).toBe(0);

    // 2. Initiate topup
    const topupRes = await request(app)
      .post('/api/v1/wallet/topup/online')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ amount: 50 });

    expect(topupRes.status).toBe(201);
    const transactionId = topupRes.body.data.id as string;

    // 3. Confirm topup
    const confirmRes = await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ transactionId });

    expect(confirmRes.status).toBe(200);

    // 4. Verify balance updated
    const walletRes = await request(app)
      .get('/api/v1/wallet')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(Number(walletRes.body.data.balance)).toBe(50);

    // 5. Verify transaction in history
    const txRes = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(txRes.status).toBe(200);
    const completedTx = txRes.body.data.find(
      (t: { id: string; status: string }) => t.id === transactionId,
    );
    expect(completedTx.status).toBe('completed');
  });

  it('confirm is idempotent — second confirm does not double-credit', async () => {
    const user = await registerAndLogin();

    // Initiate
    const topupRes = await request(app)
      .post('/api/v1/wallet/topup/online')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ amount: 25 });

    const transactionId = topupRes.body.data.id as string;

    // First confirm
    await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ transactionId });

    // Second confirm — should not double-credit
    await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ transactionId });

    // Balance should still be 25
    const walletRes = await request(app)
      .get('/api/v1/wallet')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(Number(walletRes.body.data.balance)).toBe(25);
  });

  it('multiple topups accumulate correctly', async () => {
    const user = await registerAndLogin();

    // Two topups of 25 each
    for (let i = 0; i < 2; i++) {
      const topupRes = await request(app)
        .post('/api/v1/wallet/topup/online')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: 25 });

      const transactionId = topupRes.body.data.id as string;

      await request(app)
        .post('/api/v1/wallet/topup/confirm')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ transactionId });
    }

    // Balance should be 50
    const walletRes = await request(app)
      .get('/api/v1/wallet')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(Number(walletRes.body.data.balance)).toBe(50);
  });

  it('rejects confirming non-existent transaction', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post('/api/v1/wallet/topup/confirm')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ transactionId: randomUUID() });

    expect(res.status).toBe(404);
  });
});
