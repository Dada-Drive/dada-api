import { Notification } from '@/models/index';
import * as notificationService from '@/services/notificationService';
import {
  createTestDeviceToken,
  createTestNotification,
  createTestUser,
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
import { NotificationType } from '@/types/enums';

jest.mock('@/jobs/producers', () => ({
  enqueueNotification: jest.fn().mockResolvedValue(undefined),
}));

const { enqueueNotification } = jest.requireMock<{
  enqueueNotification: jest.Mock;
}>('@/jobs/producers');

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
  jest.clearAllMocks();
});

describe('Notification Service', () => {
  // ── send ──────────────────────────────────────────────────────────────────

  describe('send', () => {
    it('persists notification to DB and enqueues FCM job', async () => {
      const user = await createTestUser();

      const result = await notificationService.send(user.id, {
        type: NotificationType.RideOffer,
        title: 'New offer',
        body: 'A driver offered 15 TND',
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(user.id);
      expect(result.type).toBe(NotificationType.RideOffer);
      expect(result.isRead).toBe(false);

      const row = await Notification.findByPk(result.id);
      expect(row).not.toBeNull();

      expect(enqueueNotification).toHaveBeenCalledWith({
        userId: user.id,
        title: 'New offer',
        body: 'A driver offered 15 TND',
        data: undefined,
        imageUrl: undefined,
      });
    });

    it('passes optional data and imageUrl to the queue', async () => {
      const user = await createTestUser();

      await notificationService.send(user.id, {
        type: NotificationType.RideCompleted,
        title: 'Ride done',
        body: 'Your ride is complete',
        data: { rideId: 'abc-123' },
        imageUrl: 'https://example.com/img.png',
      });

      expect(enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { rideId: 'abc-123' },
          imageUrl: 'https://example.com/img.png',
        }),
      );
    });
  });

  // ── getNotifications ──────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('returns paginated notifications newest first, scoped to user', async () => {
      const user = await createTestUser();
      const other = await createTestUser();
      await createTestNotification(user.id, { title: 'First' });
      await createTestNotification(user.id, { title: 'Second' });
      await createTestNotification(other.id, { title: 'Other user' });

      const { rows, meta } = await notificationService.getNotifications(user.id, {
        page: '1',
        limit: '10',
      });

      expect(rows).toHaveLength(2);
      expect(rows[0]!.title).toBe('Second');
      expect(meta.total).toBe(2);
    });

    it('respects pagination limits', async () => {
      const user = await createTestUser();
      await createTestNotification(user.id);
      await createTestNotification(user.id);
      await createTestNotification(user.id);

      const { rows, meta } = await notificationService.getNotifications(user.id, {
        page: '1',
        limit: '2',
      });

      expect(rows).toHaveLength(2);
      expect(meta.total).toBe(3);
      expect(meta.pages).toBe(2);
    });
  });

  // ── markAsRead ────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('marks a notification as read', async () => {
      const user = await createTestUser();
      const notif = await createTestNotification(user.id);

      const result = await notificationService.markAsRead(notif.id, user.id);
      expect(result.isRead).toBe(true);
    });

    it('throws 404 for non-existent notification', async () => {
      const user = await createTestUser();
      await expect(
        notificationService.markAsRead('00000000-0000-0000-0000-000000000000', user.id),
      ).rejects.toThrow('Notification not found');
    });

    it('throws 403 when user does not own the notification', async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const notif = await createTestNotification(owner.id);

      await expect(notificationService.markAsRead(notif.id, other.id)).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });

  // ── markAllAsRead ─────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read and returns count', async () => {
      const user = await createTestUser();
      await createTestNotification(user.id);
      await createTestNotification(user.id);
      await createTestNotification(user.id, { isRead: true });

      const updated = await notificationService.markAllAsRead(user.id);
      expect(updated).toBe(2);
    });

    it('returns 0 when no unread notifications exist', async () => {
      const user = await createTestUser();
      const updated = await notificationService.markAllAsRead(user.id);
      expect(updated).toBe(0);
    });
  });

  // ── getUnreadCount ────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('returns correct unread count', async () => {
      const user = await createTestUser();
      await createTestNotification(user.id);
      await createTestNotification(user.id);
      await createTestNotification(user.id, { isRead: true });

      const count = await notificationService.getUnreadCount(user.id);
      expect(count).toBe(2);
    });
  });

  // ── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('swaps old token for new token', async () => {
      const user = await createTestUser();
      await createTestDeviceToken(user.id, { token: 'old-token-abc' });

      const result = await notificationService.refreshToken(
        user.id,
        'old-token-abc',
        'new-token-xyz',
      );
      expect(result.token).toBe('new-token-xyz');
    });

    it('throws 404 when old token not found', async () => {
      const user = await createTestUser();

      await expect(
        notificationService.refreshToken(user.id, 'nonexistent', 'new-token'),
      ).rejects.toThrow('Notification not found');
    });
  });
});
