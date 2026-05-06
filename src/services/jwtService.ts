import crypto from 'crypto';

import jwt, { SignOptions } from 'jsonwebtoken';

import { config } from '@/config/index';
import { redisClient } from '@/config/redis';
import { UserRole } from '@/types/enums';
import { appError, ErrorCodes } from '@/types/errorCodes';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

interface AccessTokenPayload {
  userId: string;
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ── Token Generation ─────────────────────────────────────────────────────────

function generateAccessToken(userId: string, role: UserRole): { accessToken: string; jti: string } {
  const jti = crypto.randomUUID();

  const options: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] };
  const accessToken = jwt.sign({ userId, role, jti }, config.jwt.secret, options);

  return { accessToken, jti };
}

function generateRefreshToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId, jti: crypto.randomUUID() }, config.jwt.refreshSecret, options);
}

function generateTokenPair(userId: string, role: UserRole): TokenPair {
  const { accessToken } = generateAccessToken(userId, role);
  const refreshToken = generateRefreshToken(userId);
  return { accessToken, refreshToken };
}

// ── Token Verification ───────────────────────────────────────────────────────

function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, config.jwt.secret) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw appError(ErrorCodes.AUTH.TOKEN_EXPIRED);
    }
    throw appError(ErrorCodes.AUTH.TOKEN_INVALID);
  }
}

function verifyRefreshToken(token: string): { userId: string; jti: string } {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret) as {
      userId: string;
      jti: string;
    };
    return { userId: payload.userId, jti: payload.jti };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw appError(ErrorCodes.AUTH.TOKEN_EXPIRED);
    }
    throw appError(ErrorCodes.AUTH.TOKEN_INVALID);
  }
}

// ── Redis Blacklist ──────────────────────────────────────────────────────────

async function blacklistToken(jti: string, exp: number): Promise<void> {
  const remainingSeconds = exp - Math.floor(Date.now() / 1000);
  if (remainingSeconds <= 0) return;

  try {
    await redisClient.setex(`bl:jti:${jti}`, remainingSeconds, '1');
  } catch (err) {
    logger.error('Redis: failed to blacklist token', {
      jti,
      error: err instanceof Error ? err.message : String(err),
      component: 'jwt',
    });
  }
}

async function blacklistAllUserTokens(userId: string): Promise<void> {
  try {
    // 900s = 15 minutes — covers max access token lifetime
    await redisClient.setex(`bl:user:${userId}`, 900, '1');
  } catch (err) {
    logger.error('Redis: failed to blacklist all user tokens', {
      userId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jwt',
    });
  }
}

async function isBlacklisted(jti: string, userId: string): Promise<boolean> {
  try {
    const results = await redisClient
      .pipeline()
      .get(`bl:jti:${jti}`)
      .get(`bl:user:${userId}`)
      .exec();

    if (!results) return false;

    // Pipeline returns [[err, result], [err, result]]
    const jtiBlacklisted = results[0]?.[1] !== null;
    const userBlacklisted = results[1]?.[1] !== null;

    return jtiBlacklisted || userBlacklisted;
  } catch (err) {
    // Fail open — if Redis is down, allow the request through
    logger.warn('Redis: blacklist check failed — allowing request', {
      jti,
      userId,
      error: err instanceof Error ? err.message : String(err),
      component: 'jwt',
    });
    return false;
  }
}

// ── User Cache ───────────────────────────────────────────────────────────────

const USER_CACHE_TTL = 300; // 5 minutes

async function getCachedUser(userId: string): Promise<string | null> {
  try {
    return await redisClient.get(`user:${userId}`);
  } catch {
    return null;
  }
}

async function cacheUser(userId: string, data: string): Promise<void> {
  try {
    await redisClient.setex(`user:${userId}`, USER_CACHE_TTL, data);
  } catch {
    // Non-critical — next request will fetch from DB
  }
}

async function invalidateUserCache(userId: string): Promise<void> {
  try {
    await redisClient.del(`user:${userId}`);
  } catch {
    // Non-critical
  }
}

export {
  blacklistAllUserTokens,
  blacklistToken,
  cacheUser,
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  getCachedUser,
  invalidateUserCache,
  isBlacklisted,
  verifyAccessToken,
  verifyRefreshToken,
};
export type { AccessTokenPayload, TokenPair };
