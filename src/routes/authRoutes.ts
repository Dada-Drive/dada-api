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

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone, password]
 *             properties:
 *               fullName: { type: string, maxLength: 100, example: "Ali Ben Salem" }
 *               phone: { type: string, example: "+21612345678" }
 *               password: { type: string, minLength: 8, example: "Passw0rd" }
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/AuthUser'
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       409:
 *         description: Phone already registered
 *       422:
 *         description: Validation error
 */
authRoutes.post('/register', globalLimiter, validate(registerValidation), authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with phone and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password]
 *             properties:
 *               phone: { type: string, example: "+21612345678" }
 *               password: { type: string, example: "Passw0rd" }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/AuthUser'
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
authRoutes.post('/login', loginLimiter, validate(loginValidation), authController.login);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token pair
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       401:
 *         description: Invalid or expired refresh token
 *       429:
 *         description: Too many refresh attempts
 */
authRoutes.post(
  '/refresh-token',
  refreshLimiter,
  validate(refreshTokenValidation),
  authController.refreshToken,
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using OTP code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code, newPassword]
 *             properties:
 *               phone: { type: string, example: "+21612345678" }
 *               code: { type: string, minLength: 6, maxLength: 6, example: "123456" }
 *               newPassword: { type: string, minLength: 8, example: "NewPassw0rd" }
 *     responses:
 *       204:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired OTP code
 *       422:
 *         description: Validation error
 */
authRoutes.post(
  '/reset-password',
  globalLimiter,
  validate(resetPasswordValidation),
  authController.resetPassword,
);

/**
 * @openapi
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate with Google ID token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string, description: "Google OAuth2 ID token" }
 *               phone: { type: string, description: "Phone number (required for new users)", example: "+21612345678" }
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/AuthUser'
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       401:
 *         description: Invalid Google token
 */
authRoutes.post(
  '/google',
  globalLimiter,
  validate(googleAuthValidation),
  authController.googleAuth,
);

/**
 * @openapi
 * /auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send OTP code via SMS
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+21612345678" }
 *     responses:
 *       200:
 *         description: OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     expiresIn: { type: integer, example: 300, description: "Seconds until OTP expires" }
 *       429:
 *         description: Too many OTP requests
 */
authRoutes.post(
  '/send-otp',
  otpSendLimiter,
  validate(sendOtpValidation),
  authController.sendOtpHandler,
);

/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify an OTP code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               phone: { type: string, example: "+21612345678" }
 *               code: { type: string, minLength: 6, maxLength: 6, example: "123456" }
 *     responses:
 *       200:
 *         description: OTP verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     verified: { type: boolean, example: true }
 *       400:
 *         description: Invalid or expired OTP code
 */
authRoutes.post(
  '/verify-otp',
  globalLimiter,
  validate(verifyOtpValidation),
  authController.verifyOtpHandler,
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and blacklist tokens
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string, description: "Optional — also invalidates this refresh token" }
 *     responses:
 *       204:
 *         description: Logged out
 *       401:
 *         description: Unauthorized
 */
authRoutes.post('/logout', protect, authController.logout);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (authenticated)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string, example: "Passw0rd" }
 *               newPassword: { type: string, minLength: 8, example: "NewPassw0rd" }
 *     responses:
 *       204:
 *         description: Password changed
 *       401:
 *         description: Old password incorrect or unauthorized
 *       422:
 *         description: Validation error
 */
authRoutes.post(
  '/change-password',
  protect,
  validate(changePasswordValidation),
  authController.changePassword,
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/AuthUser'
 *       401:
 *         description: Unauthorized
 */
authRoutes.get('/me', protect, authController.getMe);

export { authRoutes };
