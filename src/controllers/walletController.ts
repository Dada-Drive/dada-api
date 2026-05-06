import { Request, Response } from 'express';

import * as walletService from '@/services/walletService';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendPaginated, sendSuccess } from '@/utils/responseHelpers';

const getBalance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const wallet = await walletService.getBalance(req.user!.userId);
  sendSuccess(res, wallet);
});

const getTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await walletService.getTransactions(
    req.user!.userId,
    req.query as Record<string, unknown>,
  );
  sendPaginated(res, rows, meta);
});

const initiateOnlineTopup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { amount } = req.body as { amount: number };
  const tx = await walletService.initiateOnlineTopup(req.user!.userId, amount);
  sendCreated(res, tx);
});

const confirmTopup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { transactionId } = req.body as { transactionId: string };
  const tx = await walletService.confirmTopup(transactionId, req.user!.userId);
  sendSuccess(res, tx);
});

const adminTopup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId, amount, description } = req.body as {
    userId: string;
    amount: number;
    description?: string;
  };
  const tx = await walletService.adminTopup(userId, amount, description);
  sendCreated(res, tx);
});

export { adminTopup, confirmTopup, getBalance, getTransactions, initiateOnlineTopup };
