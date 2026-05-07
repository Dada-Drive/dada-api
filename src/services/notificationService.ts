import { enqueueNotification } from '@/jobs/producers';
import { DeviceToken, Notification } from '@/models/index';
import { DevicePlatform, NotificationType } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';
import { buildPaginationMeta, parsePaginationQuery } from '@/utils/pagination';

import type { PaginationMeta } from '@/types/pagination';

// ── Device Token Management ────────────────────────────────────────────────

async function registerToken(
  userId: string,
  token: string,
  platform: DevicePlatform,
): Promise<DeviceToken> {
  const existing = await DeviceToken.findOne({ where: { token } });
  if (existing) {
    existing.userId = userId;
    existing.platform = platform;
    await existing.save();
    return existing;
  }

  return DeviceToken.create({ userId, token, platform });
}

async function unregisterToken(token: string, userId: string): Promise<void> {
  await DeviceToken.destroy({ where: { token, userId } });
}

async function refreshToken(
  userId: string,
  oldToken: string,
  newToken: string,
): Promise<DeviceToken> {
  const deviceToken = await DeviceToken.findOne({ where: { token: oldToken, userId } });
  if (!deviceToken) throw appError(ErrorCodes.NOTIFICATION.NOTIFICATION_NOT_FOUND);

  deviceToken.token = newToken;
  await deviceToken.save();
  return deviceToken;
}

// ── Notification CRUD ──────────────────────────────────────────────────────

interface SendInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

async function send(userId: string, input: SendInput): Promise<Notification> {
  const notification = await Notification.create({
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? null,
  });

  void enqueueNotification({
    userId,
    title: input.title,
    body: input.body,
    data: input.data,
    imageUrl: input.imageUrl,
  });

  return notification;
}

async function getNotifications(
  userId: string,
  query: Record<string, unknown>,
): Promise<{ rows: Notification[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);

  const { rows, count } = await Notification.findAndCountAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    offset,
    limit,
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

async function markAsRead(notificationId: string, userId: string): Promise<Notification> {
  const notification = await Notification.findByPk(notificationId);
  if (!notification) throw appError(ErrorCodes.NOTIFICATION.NOTIFICATION_NOT_FOUND);
  if (notification.userId !== userId) throw appError(ErrorCodes.AUTH.FORBIDDEN);

  notification.isRead = true;
  await notification.save();
  return notification;
}

async function markAllAsRead(userId: string): Promise<number> {
  const [updated] = await Notification.update(
    { isRead: true },
    { where: { userId, isRead: false } },
  );
  return updated;
}

async function getUnreadCount(userId: string): Promise<number> {
  return Notification.count({ where: { userId, isRead: false } });
}

export {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  refreshToken,
  registerToken,
  send,
  unregisterToken,
};
