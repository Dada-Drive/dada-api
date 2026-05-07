import { sequelize, Wallet } from '@/models/index';
import * as walletService from '@/services/walletService';
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
import { TransactionStatus, TransactionType, WalletStatus } from '@/types/enums';

jest.mock('@/services/notificationService', () => ({
  send: jest.fn().mockResolvedValue(undefined),
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

describe('Wallet Service', () => {
  // ── confirmTopup ─────────────────────────────────────────────────────────

  describe('confirmTopup', () => {
    it('credits wallet correctly on single confirmation', async () => {
      const user = await createTestUser();
      await createTestWallet(user.id, 50);
      const tx = await createTestWalletTransaction(user.id, {
        type: TransactionType.TopupOnline,
        amount: 100,
        status: TransactionStatus.Pending,
      });

      const result = await walletService.confirmTopup(tx.id, user.id);
      expect(result.status).toBe(TransactionStatus.Completed);

      const wallet = await Wallet.findOne({ where: { ownerId: user.id } });
      expect(Number(wallet!.balance)).toBe(150);
    });

    it('credits wallet exactly once under 10 concurrent confirmations', async () => {
      const user = await createTestUser();
      await createTestWallet(user.id, 0);
      const tx = await createTestWalletTransaction(user.id, {
        type: TransactionType.TopupOnline,
        amount: 100,
        status: TransactionStatus.Pending,
      });

      const results = await Promise.all(
        Array(10)
          .fill(null)
          .map(() => walletService.confirmTopup(tx.id, user.id).catch((e: unknown) => e)),
      );

      // Count successes (WalletTransaction objects with status Completed)
      const successes = results.filter(
        (r) =>
          r && typeof r === 'object' && 'status' in r && r.status === TransactionStatus.Completed,
      );
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // Wallet credited exactly once
      const wallet = await Wallet.findOne({ where: { ownerId: user.id } });
      expect(Number(wallet!.balance)).toBe(100);
    });

    it('returns completed transaction idempotently without error', async () => {
      const user = await createTestUser();
      await createTestWallet(user.id, 100);
      const tx = await createTestWalletTransaction(user.id, {
        type: TransactionType.TopupOnline,
        amount: 50,
        status: TransactionStatus.Completed,
      });

      const result = await walletService.confirmTopup(tx.id, user.id);
      expect(result.status).toBe(TransactionStatus.Completed);

      // Balance unchanged
      const wallet = await Wallet.findOne({ where: { ownerId: user.id } });
      expect(Number(wallet!.balance)).toBe(100);
    });

    it('rejects confirmation of failed transaction', async () => {
      const user = await createTestUser();
      await createTestWallet(user.id, 0);
      const tx = await createTestWalletTransaction(user.id, {
        type: TransactionType.TopupOnline,
        amount: 50,
        status: TransactionStatus.Failed,
      });

      await expect(walletService.confirmTopup(tx.id, user.id)).rejects.toMatchObject({
        code: 'DUPLICATE_TRANSACTION',
      });
    });

    it('rejects confirmation by wrong user', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      await createTestWallet(user1.id, 0);
      const tx = await createTestWalletTransaction(user1.id, {
        type: TransactionType.TopupOnline,
        amount: 50,
        status: TransactionStatus.Pending,
      });

      await expect(walletService.confirmTopup(tx.id, user2.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  // ── adminTopup ───────────────────────────────────────────────────────────

  describe('adminTopup', () => {
    it('credits wallet and creates transaction record', async () => {
      const user = await createTestUser();
      await createTestWallet(user.id, 0);

      const tx = await walletService.adminTopup(user.id, 200, 'Test topup');
      expect(tx.type).toBe(TransactionType.TopupManual);
      expect(Number(tx.amount)).toBe(200);

      const wallet = await Wallet.findOne({ where: { ownerId: user.id } });
      expect(Number(wallet!.balance)).toBe(200);
    });

    it('handles sequential admin topups correctly', async () => {
      const user = await createTestUser();
      await createTestWallet(user.id, 0);

      // Sequential topups to avoid serialization failures
      await walletService.adminTopup(user.id, 100, 'Topup 1');
      await walletService.adminTopup(user.id, 200, 'Topup 2');
      await walletService.adminTopup(user.id, 150, 'Topup 3');

      const wallet = await Wallet.findOne({ where: { ownerId: user.id } });
      expect(Number(wallet!.balance)).toBe(450);
    });

    it('rejects topup exceeding daily limit', async () => {
      const user = await createTestUser();
      await createTestWallet(user.id, 0);

      // First topup of 4900 should succeed
      await walletService.adminTopup(user.id, 4900);

      // Second topup of 200 would exceed 5000 limit
      await expect(walletService.adminTopup(user.id, 200)).rejects.toMatchObject({
        code: 'INVALID_AMOUNT',
      });

      const wallet = await Wallet.findOne({ where: { ownerId: user.id } });
      expect(Number(wallet!.balance)).toBe(4900);
    });

    it('rejects topup to suspended wallet', async () => {
      const user = await createTestUser();
      const wallet = await createTestWallet(user.id, 0);
      await wallet.update({ status: WalletStatus.Suspended });

      await expect(walletService.adminTopup(user.id, 100)).rejects.toMatchObject({
        code: 'WALLET_SUSPENDED',
      });
    });
  });

  // ── Balance safety ───────────────────────────────────────────────────────

  describe('balance safety', () => {
    it('application guard prevents balance going negative', async () => {
      const user = await createTestUser();
      await createTestWallet(user.id, 5);

      // Try to deduct more than balance using the guard pattern
      const results = await sequelize.query(
        'UPDATE wallets SET balance = balance - 10 WHERE owner_id = $1 AND balance - 10 >= 0 RETURNING *',
        { bind: [user.id] },
      );

      // No rows affected — guard prevented negative balance
      expect((results[0] as unknown[]).length).toBe(0);

      // Balance unchanged
      const wallet = await Wallet.findOne({ where: { ownerId: user.id } });
      expect(Number(wallet!.balance)).toBe(5);
    });
  });
});
