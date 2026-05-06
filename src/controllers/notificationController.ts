import { Request, Response } from 'express';

import * as notificationService from '@/services/notificationService';
import { DevicePlatform } from '@/types/enums';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendNoContent } from '@/utils/responseHelpers';

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

export { registerToken, unregisterToken };
