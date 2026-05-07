import { Job } from 'bullmq';

import { DeviceToken, User } from '@/models/index';
import {
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
} from '@/tests/setup';
import { DevicePlatform, UserRole } from '@/types/enums';

import { processNotification } from '../workers/notificationWorker';

import type { NotificationJobData } from '../workers/notificationWorker';

// Mock firebase-admin
const mockSend = jest.fn();
jest.mock('@/config/firebase', () => ({
  getMessaging: () => ({ send: mockSend }),
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
  mockSend.mockReset();
});

function makeJob(data: NotificationJobData): Job<NotificationJobData> {
  return { data } as unknown as Job<NotificationJobData>;
}

describe('notificationWorker', () => {
  it('skips silently when no device tokens exist', async () => {
    const job = makeJob({
      userId: '00000000-0000-4000-a000-000000000001',
      title: 'Test',
      body: 'Hello',
    });

    await processNotification(job);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends push to all device tokens for user', async () => {
    const user = await User.create({
      fullName: 'Test User',
      phone: '+21650000099',
      passwordHash: 'hashed',
      role: UserRole.Rider,
    });

    await DeviceToken.create({
      userId: user.id,
      token: 'token-1',
      platform: DevicePlatform.Android,
    });
    await DeviceToken.create({ userId: user.id, token: 'token-2', platform: DevicePlatform.Ios });

    mockSend.mockResolvedValue('message-id');

    const job = makeJob({
      userId: user.id,
      title: 'Ride Update',
      body: 'Your ride is arriving',
    });

    await processNotification(job);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'token-1',
        notification: { title: 'Ride Update', body: 'Your ride is arriving' },
      }),
    );
  });

  it('removes invalid device tokens on registration error', async () => {
    const user = await User.create({
      fullName: 'Test User',
      phone: '+21650000098',
      passwordHash: 'hashed',
      role: UserRole.Rider,
    });

    await DeviceToken.create({
      userId: user.id,
      token: 'valid-token',
      platform: DevicePlatform.Android,
    });
    await DeviceToken.create({
      userId: user.id,
      token: 'invalid-token',
      platform: DevicePlatform.Ios,
    });

    mockSend
      .mockResolvedValueOnce('message-id') // valid-token succeeds
      .mockRejectedValueOnce({ code: 'messaging/registration-token-not-registered' });

    const job = makeJob({
      userId: user.id,
      title: 'Test',
      body: 'Hello',
    });

    await processNotification(job);

    const remaining = await DeviceToken.findAll({ where: { userId: user.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.token).toBe('valid-token');
  });

  it('throws on non-registration FCM errors to trigger retry', async () => {
    const user = await User.create({
      fullName: 'Test User',
      phone: '+21650000097',
      passwordHash: 'hashed',
      role: UserRole.Rider,
    });

    await DeviceToken.create({
      userId: user.id,
      token: 'some-token',
      platform: DevicePlatform.Android,
    });
    mockSend.mockRejectedValue(new Error('FCM server unavailable'));

    const job = makeJob({
      userId: user.id,
      title: 'Test',
      body: 'Hello',
    });

    await expect(processNotification(job)).rejects.toThrow('FCM server unavailable');
  });
});
