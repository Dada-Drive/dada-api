import { sequelize, Wallet, WalletTransaction } from '@/models/index';
import { TransactionStatus, TransactionType, WalletStatus } from '@/types/enums';
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
  return sequelize.transaction(async (t) => {
    const tx = await WalletTransaction.findByPk(transactionId, { transaction: t });
    if (!tx) throw appError(ErrorCodes.GENERAL.NOT_FOUND, { message: 'Transaction not found' });
    if (tx.walletOwnerId !== userId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
    if (tx.status !== TransactionStatus.Pending) {
      throw appError(ErrorCodes.WALLET.DUPLICATE_TRANSACTION);
    }

    tx.status = TransactionStatus.Completed;
    await tx.save({ transaction: t });

    await Wallet.increment('balance', {
      by: Number(tx.amount),
      where: { ownerId: tx.walletOwnerId },
      transaction: t,
    });

    return tx;
  });
}

// ── Admin Manual Topup ──────────────────────────────────────────────────────

async function adminTopup(
  userId: string,
  amount: number,
  description?: string,
): Promise<WalletTransaction> {
  return sequelize.transaction(async (t) => {
    const wallet = await Wallet.findOne({ where: { ownerId: userId }, transaction: t });
    if (!wallet) throw appError(ErrorCodes.GENERAL.NOT_FOUND, { message: 'Wallet not found' });

    const tx = await WalletTransaction.create(
      {
        walletOwnerId: userId,
        type: TransactionType.TopupManual,
        amount,
        status: TransactionStatus.Completed,
        description: description || 'Manual topup by admin',
      },
      { transaction: t },
    );

    await Wallet.increment('balance', {
      by: amount,
      where: { ownerId: userId },
      transaction: t,
    });

    return tx;
  });
}

export { adminTopup, confirmTopup, getBalance, getTransactions, initiateOnlineTopup };
