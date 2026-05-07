import { Router } from 'express';

import * as notificationController from '@/controllers/notificationController';
import { protect } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  deleteTokenValidation,
  markAsReadValidation,
  refreshTokenValidation,
  registerTokenValidation,
} from '@/validators/notificationValidators';

const notificationRoutes = Router();

// ── Notification Inbox ─────────────────────────────────────────────────────

notificationRoutes.get('/', protect, notificationController.getNotifications);
notificationRoutes.get('/unread-count', protect, notificationController.getUnreadCount);
notificationRoutes.post('/read-all', protect, notificationController.markAllAsRead);
notificationRoutes.patch(
  '/:id/read',
  protect,
  validate(markAsReadValidation),
  notificationController.markAsRead,
);

// ── Device Tokens ──────────────────────────────────────────────────────────

notificationRoutes.post(
  '/token',
  protect,
  validate(registerTokenValidation),
  notificationController.registerToken,
);
notificationRoutes.put(
  '/token',
  protect,
  validate(refreshTokenValidation),
  notificationController.refreshDeviceToken,
);
notificationRoutes.delete(
  '/token',
  protect,
  validate(deleteTokenValidation),
  notificationController.unregisterToken,
);

export { notificationRoutes };
