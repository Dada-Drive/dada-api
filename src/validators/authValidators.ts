import { body, ValidationChain } from 'express-validator';

import { phoneField, textField } from '@/validators/common';

// ── Password ─────────────────────────────────────────────────────────────────

function passwordField(field = 'password'): ValidationChain {
  return body(field)
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one digit');
}

// ── Register ─────────────────────────────────────────────────────────────────

const registerValidation: ValidationChain[] = [
  textField('fullName', 100),
  phoneField(),
  passwordField(),
];

// ── Login ────────────────────────────────────────────────────────────────────

const loginValidation: ValidationChain[] = [
  phoneField(),
  body('password').isString().withMessage('Password is required'),
];

// ── Refresh Token ────────────────────────────────────────────────────────────

const refreshTokenValidation: ValidationChain[] = [
  body('refreshToken').isString().notEmpty().withMessage('Refresh token is required'),
];

// ── Change Password ──────────────────────────────────────────────────────────

const changePasswordValidation: ValidationChain[] = [
  body('oldPassword').isString().notEmpty().withMessage('Current password is required'),
  passwordField('newPassword'),
];

// ── Reset Password ───────────────────────────────────────────────────────────

const resetPasswordValidation: ValidationChain[] = [
  phoneField(),
  body('code')
    .isString()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP code must be 6 digits')
    .isNumeric()
    .withMessage('OTP code must contain only digits'),
  passwordField('newPassword'),
];

// ── Send OTP ─────────────────────────────────────────────────────────────────

const sendOtpValidation: ValidationChain[] = [phoneField()];

// ── Verify OTP ───────────────────────────────────────────────────────────────

const verifyOtpValidation: ValidationChain[] = [
  phoneField(),
  body('code')
    .isString()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP code must be 6 digits')
    .isNumeric()
    .withMessage('OTP code must contain only digits'),
];

// ── Google Auth ──────────────────────────────────────────────────────────────

const googleAuthValidation: ValidationChain[] = [
  body('idToken').isString().notEmpty().withMessage('Google ID token is required'),
  body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
];

export {
  changePasswordValidation,
  googleAuthValidation,
  loginValidation,
  passwordField,
  refreshTokenValidation,
  registerValidation,
  resetPasswordValidation,
  sendOtpValidation,
  verifyOtpValidation,
};
