import { Router } from 'express';

import * as walletController from '@/controllers/walletController';
import { protect, restrictTo } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { UserRole } from '@/types/enums';
import {
  adminTopupValidation,
  confirmTopupValidation,
  initiateTopupValidation,
  transactionListValidation,
} from '@/validators/walletValidators';

const walletRoutes = Router();

/**
 * @openapi
 * /wallet:
 *   get:
 *     tags: [Wallet]
 *     summary: Get wallet balance
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Wallet details } }
 * /wallet/transactions:
 *   get:
 *     tags: [Wallet]
 *     summary: Get transaction history (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses: { 200: { description: Paginated transactions } }
 * /wallet/topup/online:
 *   post:
 *     tags: [Wallet]
 *     summary: Initiate Flouci online topup
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Pending transaction created } }
 * /wallet/topup/confirm:
 *   post:
 *     tags: [Wallet]
 *     summary: Confirm online topup
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Topup confirmed } }
 * /wallet/topup/manual:
 *   post:
 *     tags: [Wallet]
 *     summary: Admin manual topup
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Manual topup created }, 403: { description: Admin only } }
 */

walletRoutes.get('/', protect, walletController.getBalance);
walletRoutes.get(
  '/transactions',
  protect,
  validate(transactionListValidation),
  walletController.getTransactions,
);
walletRoutes.post(
  '/topup/online',
  protect,
  validate(initiateTopupValidation),
  walletController.initiateOnlineTopup,
);
walletRoutes.post(
  '/topup/confirm',
  protect,
  validate(confirmTopupValidation),
  walletController.confirmTopup,
);
walletRoutes.post(
  '/topup/manual',
  protect,
  restrictTo(UserRole.Admin),
  validate(adminTopupValidation),
  walletController.adminTopup,
);

export { walletRoutes };
