import { Request, Response } from 'express';

import * as authService from '@/services/authService';
import { sendOtp } from '@/services/otpService';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '@/utils/responseHelpers';

// ── Register ─────────────────────────────────────────────────────────────────

const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { fullName, phone, password } = req.body as {
    fullName: string;
    phone: string;
    password: string;
  };

  const result = await authService.register({ fullName, phone, password });
  sendCreated(res, result);
});

// ── Login ────────────────────────────────────────────────────────────────────

const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { phone, password } = req.body as { phone: string; password: string };

  const result = await authService.login(phone, password);
  sendSuccess(res, result);
});

// ── Refresh Token ────────────────────────────────────────────────────────────

const refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken: token } = req.body as { refreshToken: string };

  const tokens = await authService.refreshToken(token);
  sendSuccess(res, tokens);
});

// ── Logout ───────────────────────────────────────────────────────────────────

const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const accessToken = req.headers.authorization!.slice(7);
  const { refreshToken: refreshTokenStr } = req.body as { refreshToken?: string };

  await authService.logout(accessToken, refreshTokenStr);
  sendNoContent(res);
});

// ── Change Password ──────────────────────────────────────────────────────────

const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { oldPassword, newPassword } = req.body as {
    oldPassword: string;
    newPassword: string;
  };

  await authService.changePassword(req.user!.userId, oldPassword, newPassword);
  sendNoContent(res);
});

// ── Reset Password with OTP ──────────────────────────────────────────────────

const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { phone, code, newPassword } = req.body as {
    phone: string;
    code: string;
    newPassword: string;
  };

  await authService.resetPasswordWithOtp(phone, code, newPassword);
  sendNoContent(res);
});

// ── Send OTP ─────────────────────────────────────────────────────────────────

const sendOtpHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body as { phone: string };

  const result = await sendOtp(phone);
  sendSuccess(res, result);
});

// ── Verify OTP ───────────────────────────────────────────────────────────────

const verifyOtpHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { phone, code } = req.body as { phone: string; code: string };

  const result = await authService.verifyOtpAndAuthenticate(phone, code);
  sendSuccess(res, result);
});

// ── Google Auth ──────────────────────────────────────────────────────────────

const googleAuth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { idToken, phone } = req.body as { idToken: string; phone?: string };

  const result = await authService.googleAuth(idToken, phone);
  sendSuccess(res, result);
});

// ── Get Me ───────────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await authService.getMe(req.user!.userId);
  sendSuccess(res, user);
});

export {
  changePassword,
  getMe,
  googleAuth,
  login,
  logout,
  refreshToken,
  register,
  resetPassword,
  sendOtpHandler,
  verifyOtpHandler,
};
