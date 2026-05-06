import { AppError } from '@/utils/AppError';

// ── Error Definition Type ─────────────────────────────────────────────────────

interface ErrorDef {
  readonly code: string;
  readonly status: number;
  readonly message: string;
}

// ── Domain Error Codes ────────────────────────────────────────────────────────

const AUTH = {
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    status: 401,
    message: 'Invalid email/phone or password',
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    status: 401,
    message: 'Authentication token has expired',
  },
  TOKEN_INVALID: { code: 'TOKEN_INVALID', status: 401, message: 'Authentication token is invalid' },
  ACCOUNT_SUSPENDED: {
    code: 'ACCOUNT_SUSPENDED',
    status: 403,
    message: 'Account has been suspended',
  },
  ACCOUNT_NOT_FOUND: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'Account not found' },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401, message: 'Authentication required' },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403, message: 'Insufficient permissions' },
} as const;

const OTP = {
  OTP_EXPIRED: { code: 'OTP_EXPIRED', status: 400, message: 'OTP has expired' },
  OTP_INVALID: { code: 'OTP_INVALID', status: 400, message: 'Invalid OTP code' },
  OTP_MAX_ATTEMPTS: {
    code: 'OTP_MAX_ATTEMPTS',
    status: 429,
    message: 'Maximum OTP verification attempts exceeded',
  },
  OTP_RATE_LIMITED: { code: 'OTP_RATE_LIMITED', status: 429, message: 'Too many OTP requests' },
} as const;

const USER = {
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' },
  PHONE_ALREADY_EXISTS: {
    code: 'PHONE_ALREADY_EXISTS',
    status: 409,
    message: 'Phone number is already in use',
  },
} as const;

const RIDE = {
  RIDE_NOT_FOUND: { code: 'RIDE_NOT_FOUND', status: 404, message: 'Ride not found' },
  RIDE_INVALID_STATUS: {
    code: 'RIDE_INVALID_STATUS',
    status: 400,
    message: 'Invalid ride status transition',
  },
  RIDE_ALREADY_ACCEPTED: {
    code: 'RIDE_ALREADY_ACCEPTED',
    status: 409,
    message: 'Ride has already been accepted',
  },
  RIDE_EXPIRED: { code: 'RIDE_EXPIRED', status: 410, message: 'Ride request has expired' },
  RIDE_OUTSIDE_BOUNDS: {
    code: 'RIDE_OUTSIDE_BOUNDS',
    status: 400,
    message: 'Ride location is outside service area',
  },
  OFFER_NOT_FOUND: { code: 'OFFER_NOT_FOUND', status: 404, message: 'Ride offer not found' },
  RIDE_STOP_NOT_FOUND: {
    code: 'RIDE_STOP_NOT_FOUND',
    status: 404,
    message: 'Ride stop not found',
  },
} as const;

const WALLET = {
  INSUFFICIENT_BALANCE: {
    code: 'INSUFFICIENT_BALANCE',
    status: 400,
    message: 'Insufficient wallet balance',
  },
  WALLET_SUSPENDED: { code: 'WALLET_SUSPENDED', status: 403, message: 'Wallet has been suspended' },
  DUPLICATE_TRANSACTION: {
    code: 'DUPLICATE_TRANSACTION',
    status: 409,
    message: 'Transaction has already been processed',
  },
  INVALID_AMOUNT: { code: 'INVALID_AMOUNT', status: 400, message: 'Invalid transaction amount' },
} as const;

const DRIVER = {
  DRIVER_NOT_APPROVED: {
    code: 'DRIVER_NOT_APPROVED',
    status: 403,
    message: 'Driver profile is not approved',
  },
  DRIVER_OFFLINE: { code: 'DRIVER_OFFLINE', status: 400, message: 'Driver is currently offline' },
  DRIVER_NOT_FOUND: { code: 'DRIVER_NOT_FOUND', status: 404, message: 'Driver not found' },
  VEHICLE_NOT_FOUND: { code: 'VEHICLE_NOT_FOUND', status: 404, message: 'Vehicle not found' },
} as const;

const RATING = {
  RATING_NOT_FOUND: { code: 'RATING_NOT_FOUND', status: 404, message: 'Rating not found' },
  RATING_ALREADY_EXISTS: {
    code: 'RATING_ALREADY_EXISTS',
    status: 409,
    message: 'Rating has already been submitted for this ride',
  },
} as const;

const UPLOAD = {
  UPLOAD_INVALID_TYPE: {
    code: 'UPLOAD_INVALID_TYPE',
    status: 400,
    message: 'File type is not allowed',
  },
  UPLOAD_TOO_LARGE: { code: 'UPLOAD_TOO_LARGE', status: 413, message: 'File size exceeds limit' },
  UPLOAD_RATE_LIMITED: {
    code: 'UPLOAD_RATE_LIMITED',
    status: 429,
    message: 'Too many uploads — please try again later',
  },
} as const;

const GENERAL = {
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400, message: 'Validation failed' },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404, message: 'Resource not found' },
  RATE_LIMITED: { code: 'RATE_LIMITED', status: 429, message: 'Too many requests' },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500, message: 'An unexpected error occurred' },
} as const;

// ── Aggregated Export ─────────────────────────────────────────────────────────

const ErrorCodes = { AUTH, OTP, USER, RIDE, WALLET, DRIVER, RATING, UPLOAD, GENERAL } as const;

// ── Union Type of All Error Code Strings ──────────────────────────────────────

type ExtractCodes<T> = T extends Record<string, { readonly code: infer C }> ? C : never;

type ErrorCode =
  | ExtractCodes<typeof AUTH>
  | ExtractCodes<typeof OTP>
  | ExtractCodes<typeof USER>
  | ExtractCodes<typeof RIDE>
  | ExtractCodes<typeof WALLET>
  | ExtractCodes<typeof DRIVER>
  | ExtractCodes<typeof RATING>
  | ExtractCodes<typeof UPLOAD>
  | ExtractCodes<typeof GENERAL>;

// ── Factory Function ──────────────────────────────────────────────────────────

function appError(def: ErrorDef, details?: Record<string, unknown>): AppError {
  return new AppError(def.message, def.status, def.code, details);
}

export { ErrorCodes, appError };
export type { ErrorCode, ErrorDef };
