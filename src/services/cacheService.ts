import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

// ── Constants ───────────────────────────────────────────────────────────────

const SCAN_BATCH_SIZE = 100;

// ── Generic Cache Operations ────────────────────────────────────────────────

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn('Cache: GET failed', {
      key,
      error: err instanceof Error ? err.message : String(err),
      component: 'cache',
    });
    return null;
  }
}

async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn('Cache: SET failed', {
      key,
      error: err instanceof Error ? err.message : String(err),
      component: 'cache',
    });
  }
}

async function cacheDel(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.warn('Cache: DEL failed', {
      key,
      error: err instanceof Error ? err.message : String(err),
      component: 'cache',
    });
  }
}

async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        SCAN_BATCH_SIZE,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('Cache: DEL pattern failed', {
      pattern,
      error: err instanceof Error ? err.message : String(err),
      component: 'cache',
    });
  }
}

export { cacheDel, cacheDelPattern, cacheGet, cacheSet };
