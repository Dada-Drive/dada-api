import Redis from 'ioredis';

import { config } from '@/config/index';
import { logger } from '@/utils/logger';

// ── BullMQ Redis Connection ─────────────────────────────────────────────────
// BullMQ requires maxRetriesPerRequest: null (it manages retries internally).
// This is incompatible with the app's main redisClient, so we use a dedicated factory.

let sharedConnection: Redis | null = null;

function createBullMQConnection(): Redis {
  return new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number): number | null {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
  });
}

function getSharedConnection(): Redis {
  if (!sharedConnection) {
    sharedConnection = createBullMQConnection();
    sharedConnection.on('error', (err: Error) => {
      logger.error('BullMQ Redis: connection error', {
        error: err.message,
        component: 'jobs',
      });
    });
  }
  return sharedConnection;
}

async function closeSharedConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}

export { closeSharedConnection, createBullMQConnection, getSharedConnection };
