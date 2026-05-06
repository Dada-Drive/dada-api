import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { redisClient } from '@/config/redis';

// ── Custom error response matching project format ────────────────────────────

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests — please try again later',
    },
  });
}

// ── Store factory ────────────────────────────────────────────────────────────

function createRedisStore(prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: async (
      ...args: string[]
    ): Promise<number | string | boolean | (number | string | boolean)[]> => {
      const [command, ...rest] = args;
      const result = await redisClient.call(command!, ...rest);
      return result as number | string;
    },
    prefix: `rl:${prefix}:`,
  });
}

// ── Limiter instances ────────────────────────────────────────────────────────

// Global: 100,000 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('global'),
  handler: rateLimitHandler,
});

// Auth login: 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('login'),
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
});

// Auth refresh: 30 per 15 minutes per IP
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('refresh'),
  handler: rateLimitHandler,
});

// OTP send: 5 per 15 minutes per IP (phone-level limiting is in otpService)
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('otp'),
  handler: rateLimitHandler,
});

export { globalLimiter, loginLimiter, otpSendLimiter, refreshLimiter };
