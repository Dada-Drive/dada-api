import { Request, Response } from 'express';

import * as notificationService from '@/services/notificationService';
import { DevicePlatform } from '@/types/enums';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendNoContent, sendPaginated, sendSuccess } from '@/utils/responseHelpers';

// ── Device Tokens ──────────────────────────────────────────────────────────

const registerToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token, platform } = req.body as { token: string; platform: DevicePlatform };
  const deviceToken = await notificationService.registerToken(req.user!.userId, token, platform);
  sendCreated(res, deviceToken);
});

const unregisterToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body as { token: string };
  await notificationService.unregisterToken(token, req.user!.userId);
  sendNoContent(res);
});

const refreshDeviceToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { oldToken, newToken } = req.body as { oldToken: string; newToken: string };
  const deviceToken = await notificationService.refreshToken(req.user!.userId, oldToken, newToken);
  sendSuccess(res, deviceToken);
});

// ── Notifications ──────────────────────────────────────────────────────────

const getNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await notificationService.getNotifications(
    req.user!.userId,
    req.query as Record<string, unknown>,
  );
  sendPaginated(res, rows, meta);
});

const getUnreadCount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const count = await notificationService.getUnreadCount(req.user!.userId);
  sendSuccess(res, { count });
});

const markAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const notification = await notificationService.markAsRead(
    req.params.id as string,
    req.user!.userId,
  );
  sendSuccess(res, notification);
});

const markAllAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const updated = await notificationService.markAllAsRead(req.user!.userId);
  sendSuccess(res, { updated });
});

export {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  refreshDeviceToken,
  registerToken,
  unregisterToken,
};
