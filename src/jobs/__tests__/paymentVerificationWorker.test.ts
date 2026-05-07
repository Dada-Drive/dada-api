import { Job } from 'bullmq';

import { WalletTransaction } from '@/models/index';
import { createTestUser, createTestWallet, resetFactoryCounters } from '@/tests/helpers/factories';
import {
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
} from '@/tests/setup';
import { TransactionStatus, TransactionType, UserRole } from '@/types/enums';

import { processPaymentVerification } from '../workers/paymentVerificationWorker';

import type { PaymentVerificationJobData } from '../workers/paymentVerificationWorker';

// Mock socket emitter
jest.mock('@/sockets/emitter', () => ({
  emitToRideRoom: jest.fn(),
  emitToUser: jest.fn(),
  emitToNearbyDrivers: jest.fn().mockResolvedValue(undefined),
  joinRideRoom: jest.fn().mockResolvedValue(undefined),
  leaveRideRoom: jest.fn().mockResolvedValue(undefined),
}));

// Mock global fetch for Flouci API
const mockFetch = jest.fn();
global.fetch = mockFetch;

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
  mockFetch.mockReset();
});

function makeJob(data: PaymentVerificationJobData): Job<PaymentVerificationJobData> {
  return { data } as unknown as Job<PaymentVerificationJobData>;
}

describe('paymentVerificationWorker', () => {
  it('credits wallet when Flouci returns SUCCESS', async () => {
    const user = await createTestUser({ role: UserRole.Rider });
    await createTestWallet(user.id);

    const tx = await WalletTransaction.create({
      walletOwnerId: user.id,
      type: TransactionType.TopupOnline,
      amount: 50,
      status: TransactionStatus.Pending,
      description: 'Online topup',
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: 'SUCCESS' } }),
    });

    const job = makeJob({
      transactionId: tx.id,
      userId: user.id,
      flouciPaymentId: 'flouci-123',
    });

    await processPaymentVerification(job);

    const updatedTx = await WalletTransaction.findByPk(tx.id);
    expect(updatedTx!.status).toBe(TransactionStatus.Completed);
  });

  it('marks transaction as failed when Flouci returns FAILED', async () => {
    const user = await createTestUser({ role: UserRole.Rider });
    await createTestWallet(user.id);

    const tx = await WalletTransaction.create({
      walletOwnerId: user.id,
      type: TransactionType.TopupOnline,
      amount: 30,
      status: TransactionStatus.Pending,
      description: 'Online topup',
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: 'FAILED' } }),
    });

    const job = makeJob({
      transactionId: tx.id,
      userId: user.id,
      flouciPaymentId: 'flouci-456',
    });

    await processPaymentVerification(job);

    const updatedTx = await WalletTransaction.findByPk(tx.id);
    expect(updatedTx!.status).toBe(TransactionStatus.Failed);
  });

  it('throws on PENDING status to trigger retry', async () => {
    const user = await createTestUser({ role: UserRole.Rider });
    await createTestWallet(user.id);

    const tx = await WalletTransaction.create({
      walletOwnerId: user.id,
      type: TransactionType.TopupOnline,
      amount: 25,
      status: TransactionStatus.Pending,
      description: 'Online topup',
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: 'PENDING' } }),
    });

    const job = makeJob({
      transactionId: tx.id,
      userId: user.id,
      flouciPaymentId: 'flouci-789',
    });

    await expect(processPaymentVerification(job)).rejects.toThrow('Payment still pending');
  });

  it('throws on Flouci API HTTP error to trigger retry', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    const job = makeJob({
      transactionId: '00000000-0000-4000-a000-000000000001',
      userId: '00000000-0000-4000-a000-000000000002',
      flouciPaymentId: 'flouci-err',
    });

    await expect(processPaymentVerification(job)).rejects.toThrow('Flouci API returned 503');
  });

  it('is idempotent — confirmTopup handles already completed transactions', async () => {
    const user = await createTestUser({ role: UserRole.Rider });
    await createTestWallet(user.id);

    const tx = await WalletTransaction.create({
      walletOwnerId: user.id,
      type: TransactionType.TopupOnline,
      amount: 50,
      status: TransactionStatus.Pending,
      description: 'Online topup',
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: 'SUCCESS' } }),
    });

    const job = makeJob({
      transactionId: tx.id,
      userId: user.id,
      flouciPaymentId: 'flouci-idem',
    });

    // First call credits
    await processPaymentVerification(job);
    // Second call should not throw (idempotent)
    await processPaymentVerification(job);

    const updatedTx = await WalletTransaction.findByPk(tx.id);
    expect(updatedTx!.status).toBe(TransactionStatus.Completed);
  });
});
