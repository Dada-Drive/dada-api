import { NextFunction, Request, Response } from 'express';

import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

const IDEMPOTENCY_TTL = 86400; // 24 hours

interface CachedResponse {
  statusCode: number;
  body: unknown;
}

function idempotency() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key) return next();

    const userId = req.user?.userId;
    if (!userId) return next();

    const redisKey = `idempotency:${userId}:${key}`;

    try {
      const cached = await redisClient.get(redisKey);
      if (cached) {
        const { statusCode, body } = JSON.parse(cached) as CachedResponse;
        res.status(statusCode).json(body);
        return;
      }
    } catch {
      // Redis down — fail open
      logger.warn('Idempotency middleware: Redis unavailable, proceeding without cache');
      return next();
    }

    // Intercept res.json to cache the first successful response
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      // Only cache 2xx responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payload: CachedResponse = { statusCode: res.statusCode, body };
        redisClient
          .setex(redisKey, IDEMPOTENCY_TTL, JSON.stringify(payload))
          .catch(() => logger.warn('Idempotency middleware: failed to cache response'));
      }
      return originalJson(body);
    }) as Response['json'];

    next();
  };
}

export { idempotency };
