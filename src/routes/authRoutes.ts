import { Router } from 'express';

import * as authController from '@/controllers/authController';
import { protect } from '@/middlewares/auth';
import {
  globalLimiter,
  loginLimiter,
  otpSendLimiter,
  refreshLimiter,
} from '@/middlewares/rateLimiter';
import { validate } from '@/middlewares/validate';
import {
  changePasswordValidation,
  googleAuthValidation,
  loginValidation,
  refreshTokenValidation,
  registerValidation,
  resetPasswordValidation,
  sendOtpValidation,
  verifyOtpValidation,
} from '@/validators/authValidators';

const authRoutes = Router();

// Public routes
authRoutes.post('/register', globalLimiter, validate(registerValidation), authController.register);
authRoutes.post('/login', loginLimiter, validate(loginValidation), authController.login);
authRoutes.post(
  '/refresh-token',
  refreshLimiter,
  validate(refreshTokenValidation),
  authController.refreshToken,
);
authRoutes.post(
  '/reset-password',
  globalLimiter,
  validate(resetPasswordValidation),
  authController.resetPassword,
);
authRoutes.post(
  '/google',
  globalLimiter,
  validate(googleAuthValidation),
  authController.googleAuth,
);

// OTP routes
authRoutes.post(
  '/send-otp',
  otpSendLimiter,
  validate(sendOtpValidation),
  authController.sendOtpHandler,
);
authRoutes.post(
  '/verify-otp',
  globalLimiter,
  validate(verifyOtpValidation),
  authController.verifyOtpHandler,
);

// Protected routes
authRoutes.post('/logout', protect, authController.logout);
authRoutes.post(
  '/change-password',
  protect,
  validate(changePasswordValidation),
  authController.changePassword,
);
authRoutes.get('/me', protect, authController.getMe);

export { authRoutes };
