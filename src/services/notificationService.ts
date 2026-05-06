import { DeviceToken } from '@/models/index';
import { DevicePlatform } from '@/types/enums';

async function registerToken(
  userId: string,
  token: string,
  platform: DevicePlatform,
): Promise<DeviceToken> {
  // Upsert — same token updates platform
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

export { registerToken, unregisterToken };
