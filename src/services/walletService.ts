import { Op, QueryTypes, Transaction } from 'sequelize';

import { FARE_CONFIG } from '@/config/fareConfig';
import { sequelize, Wallet, WalletTransaction } from '@/models/index';
import * as notificationService from '@/services/notificationService';
import { NotificationType, TransactionStatus, TransactionType, WalletStatus } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';
import { parseFilters, parseSorting } from '@/utils/filtering';
import { buildPaginationMeta, parsePaginationQuery } from '@/utils/pagination';

import type { PaginationMeta } from '@/types/pagination';

// ── Get Balance ─────────────────────────────────────────────────────────────

async function getBalance(userId: string): Promise<Wallet> {
  const wallet = await Wallet.findOne({ where: { ownerId: userId } });
  if (!wallet) throw appError(ErrorCodes.GENERAL.NOT_FOUND, { message: 'Wallet not found' });
  return wallet;
}

// ── Get Transactions ────────────────────────────────────────────────────────

async function getTransactions(
  userId: string,
  query: Record<string, unknown>,
): Promise<{ rows: WalletTransaction[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);
  const where = {
    walletOwnerId: userId,
    ...parseFilters(query, ['type', 'status']),
  };
  const order = parseSorting(query.sort, ['createdAt', 'amount', 'type']);

  const { rows, count } = await WalletTransaction.findAndCountAll({
    where,
    order,
    offset,
    limit,
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── Initiate Online Topup (Flouci — stub for Phase 5) ──────────────────────

async function initiateOnlineTopup(userId: string, amount: number): Promise<WalletTransaction> {
  const wallet = await Wallet.findOne({ where: { ownerId: userId } });
  if (!wallet) throw appError(ErrorCodes.GENERAL.NOT_FOUND, { message: 'Wallet not found' });
  if (wallet.status !== WalletStatus.Active) throw appError(ErrorCodes.WALLET.WALLET_SUSPENDED);

  return WalletTransaction.create({
    walletOwnerId: userId,
    type: TransactionType.TopupOnline,
    amount,
    status: TransactionStatus.Pending,
    description: 'Online topup via Flouci',
  });
}

// ── Confirm Topup ───────────────────────────────────────────────────────────

async function confirmTopup(transactionId: string, userId: string): Promise<WalletTransaction> {
  const tx = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (t) => {
      const row = await WalletTransaction.findByPk(transactionId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!row) throw appError(ErrorCodes.GENERAL.NOT_FOUND, { message: 'Transaction not found' });
      if (row.walletOwnerId !== userId) throw appError(ErrorCodes.AUTH.FORBIDDEN);

      // Idempotent: already completed → return without side effects
      if (row.status === TransactionStatus.Completed) return row;

      // Not pending → not retriable
      if (row.status !== TransactionStatus.Pending) {
        throw appError(ErrorCodes.WALLET.DUPLICATE_TRANSACTION);
      }

      // Credit wallet with application guard
      const results = await sequelize.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE owner_id = $2 AND balance + $1 >= 0 RETURNING *',
        { bind: [Number(row.amount), row.walletOwnerId], transaction: t, type: QueryTypes.SELECT },
      );
      if (results.length === 0) {
        throw appError(ErrorCodes.WALLET.INSUFFICIENT_BALANCE);
      }

      row.status = TransactionStatus.Completed;
      await row.save({ transaction: t });
      return row;
    },
  );

  void notificationService.send(userId, {
    type: NotificationType.WalletTopupConfirmed,
    title: 'Top-up confirmed',
    body: `${String(Number(tx.amount))} TND has been added to your wallet`,
    data: { transactionId: tx.id },
  });

  return tx;
}

// ── Admin Manual Topup ──────────────────────────────────────────────────────

async function adminTopup(
  userId: string,
  amount: number,
  description?: string,
): Promise<WalletTransaction> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (t) => {
      const wallet = await Wallet.findOne({
        where: { ownerId: userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!wallet) throw appError(ErrorCodes.GENERAL.NOT_FOUND, { message: 'Wallet not found' });
      if (wallet.status !== WalletStatus.Active) throw appError(ErrorCodes.WALLET.WALLET_SUSPENDED);

      // Daily limit check
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayTotal =
        (await WalletTransaction.sum('amount', {
          where: {
            walletOwnerId: userId,
            type: TransactionType.TopupManual,
            createdAt: { [Op.gte]: startOfDay },
          },
          transaction: t,
        })) || 0;

      if (todayTotal + amount > FARE_CONFIG.ADMIN_DAILY_TOPUP_LIMIT) {
        throw appError(ErrorCodes.WALLET.INVALID_AMOUNT, {
          message: `Daily admin topup limit (${FARE_CONFIG.ADMIN_DAILY_TOPUP_LIMIT} TND) would be exceeded`,
        });
      }

      // Credit wallet with application guard
      const results = await sequelize.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE owner_id = $2 AND balance + $1 >= 0 RETURNING *',
        { bind: [amount, userId], transaction: t, type: QueryTypes.SELECT },
      );
      if (results.length === 0) {
        throw appError(ErrorCodes.WALLET.INSUFFICIENT_BALANCE);
      }

      return WalletTransaction.create(
        {
          walletOwnerId: userId,
          type: TransactionType.TopupManual,
          amount,
          status: TransactionStatus.Completed,
          description: description || 'Manual topup by admin',
        },
        { transaction: t },
      );
    },
  );
}

export { adminTopup, confirmTopup, getBalance, getTransactions, initiateOnlineTopup };
