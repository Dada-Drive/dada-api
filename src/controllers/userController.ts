import { Request, Response } from 'express';

import * as userService from '@/services/userService';
import { UserRole } from '@/types/enums';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendNoContent, sendSuccess } from '@/utils/responseHelpers';

// ── Get Profile ─────────────────────────────────────────────────────────────

const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const profile = await userService.getProfile(req.user!.userId);
  sendSuccess(res, profile);
});

// ── Update Profile ──────────────────────────────────────────────────────────

const updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, avatarUrl } = req.body as {
    fullName?: string;
    email?: string | null;
    avatarUrl?: string | null;
  };

  const profile = await userService.updateProfile(req.user!.userId, { fullName, email, avatarUrl });
  sendSuccess(res, profile);
});

// ── Update Phone ────────────────────────────────────────────────────────────

const updatePhone = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body as { phone: string };

  const profile = await userService.updatePhone(req.user!.userId, phone);
  sendSuccess(res, profile);
});

// ── Set Role ────────────────────────────────────────────────────────────────

const setRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { role } = req.body as { role: UserRole };

  const profile = await userService.setRole(req.user!.userId, role);
  sendSuccess(res, profile);
});

// ── Deactivate Account ──────────────────────────────────────────────────────

const deactivateAccount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await userService.deactivateAccount(req.user!.userId);
  sendNoContent(res);
});

export { deactivateAccount, getProfile, setRole, updatePhone, updateProfile };
