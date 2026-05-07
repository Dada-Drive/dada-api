import Redis from 'ioredis';

import { config } from '@/config/index';
import { logger } from '@/utils/logger';

// ── Redis Client ─────────────────────────────────────────────────────────────

const redisClient = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 10) {
      logger.error('Redis: max reconnection attempts reached — giving up', {
        component: 'redis',
      });
      return null;
    }
    const delay = Math.min(times * 200, 5000);
    logger.warn(`Redis: reconnecting in ${String(delay)}ms (attempt ${String(times)})`, {
      component: 'redis',
    });
    return delay;
  },
  lazyConnect: true,
});

redisClient.on('connect', () => {
  logger.info('Redis: connection established', { component: 'redis' });
});

redisClient.on('error', (err: Error) => {
  logger.error('Redis: connection error', {
    error: err.message,
    component: 'redis',
  });
});

redisClient.on('close', () => {
  logger.warn('Redis: connection closed', { component: 'redis' });
});

// ── Connection helpers ───────────────────────────────────────────────────────

async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.error('Redis: failed to connect', {
      error: err instanceof Error ? err.message : String(err),
      component: 'redis',
    });
    // Non-fatal — server operates without Redis in degraded mode
  }
}

async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    logger.info('Redis: connection closed gracefully', { component: 'redis' });
  } catch (err) {
    logger.error('Redis: error during disconnect', {
      error: err instanceof Error ? err.message : String(err),
      component: 'redis',
    });
  }
}

async function pingRedis(): Promise<boolean> {
  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// ── Factory for additional Redis clients ────────────────────────────────────

function createRedisClient(): Redis {
  return new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number): number | null {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
  });
}

export { connectRedis, createRedisClient, disconnectRedis, pingRedis, redisClient };
