import { Request, Response, NextFunction } from 'express';

import { User } from '@/models/index';
import { cacheUser, getCachedUser, isBlacklisted, verifyAccessToken } from '@/services/jwtService';
import { UserRole } from '@/types/enums';
import { appError, ErrorCodes } from '@/types/errorCodes';
import { logger } from '@/utils/logger';

// ── protect ──────────────────────────────────────────────────────────────────

async function protect(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // 1. Extract Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw appError(ErrorCodes.AUTH.UNAUTHORIZED);
  }

  const token = authHeader.slice(7);

  // 2. Verify JWT (throws TOKEN_EXPIRED or TOKEN_INVALID)
  const payload = verifyAccessToken(token);

  // 3. Check blacklist (jti-level and user-level)
  const blacklisted = await isBlacklisted(payload.jti, payload.userId);
  if (blacklisted) {
    throw appError(ErrorCodes.AUTH.TOKEN_INVALID);
  }

  // 4. Fetch user from cache or DB
  const cached = await getCachedUser(payload.userId);

  if (cached) {
    const userData = JSON.parse(cached) as { isActive: boolean; role: UserRole };

    if (!userData.isActive) {
      throw appError(ErrorCodes.AUTH.ACCOUNT_SUSPENDED);
    }

    req.user = { userId: payload.userId, role: userData.role };
    next();
    return;
  }

  // Cache miss — query DB
  const user = await User.findByPk(payload.userId, {
    attributes: ['id', 'role', 'isActive'],
  });

  if (!user) {
    throw appError(ErrorCodes.AUTH.ACCOUNT_NOT_FOUND);
  }

  if (!user.isActive) {
    throw appError(ErrorCodes.AUTH.ACCOUNT_SUSPENDED);
  }

  // Cache for next requests
  await cacheUser(payload.userId, JSON.stringify({ isActive: user.isActive, role: user.role }));

  req.user = { userId: user.id, role: user.role };
  next();
}

// ── restrictTo ───────────────────────────────────────────────────────────────

function restrictTo(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw appError(ErrorCodes.AUTH.UNAUTHORIZED);
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Access denied — insufficient role', {
        userId: req.user.userId,
        requiredRoles: roles,
        actualRole: req.user.role,
        component: 'auth',
      });
      throw appError(ErrorCodes.AUTH.FORBIDDEN);
    }

    next();
  };
}

export { protect, restrictTo };
