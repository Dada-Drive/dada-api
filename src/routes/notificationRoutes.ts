import { Router } from 'express';

import * as notificationController from '@/controllers/notificationController';
import { protect } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  deleteTokenValidation,
  registerTokenValidation,
} from '@/validators/notificationValidators';

const notificationRoutes = Router();

/**
 * @openapi
 * /notifications/token:
 *   post:
 *     tags: [Notifications]
 *     summary: Register device token for push notifications
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, platform]
 *             properties:
 *               token: { type: string }
 *               platform: { type: string, enum: [ios, android] }
 *     responses: { 201: { description: Token registered } }
 *   delete:
 *     tags: [Notifications]
 *     summary: Unregister device token
 *     security: [{ bearerAuth: [] }]
 *     responses: { 204: { description: Token removed } }
 */

notificationRoutes.post(
  '/token',
  protect,
  validate(registerTokenValidation),
  notificationController.registerToken,
);
notificationRoutes.delete(
  '/token',
  protect,
  validate(deleteTokenValidation),
  notificationController.unregisterToken,
);

export { notificationRoutes };
