// Note: env vars are set by src/tests/env.ts (via jest.config.ts setupFiles)
// which runs BEFORE any module imports.

import { redisClient } from '@/config/redis';
import { sequelize } from '@/models/index';

// ── Database lifecycle ───────────────────────────────────────────────────────

async function setupTestDatabase(): Promise<void> {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
}

async function teardownTestDatabase(): Promise<void> {
  await sequelize.close();
}

async function truncateAllTables(): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE users, wallets, refresh_tokens, otp_codes, driver_profiles, vehicles, rides, ride_offers, ride_stops, shared_ride_passengers, wallet_transactions, ratings, device_tokens CASCADE',
  );
}

// ── Redis lifecycle ──────────────────────────────────────────────────────────

async function setupTestRedis(): Promise<void> {
  if (redisClient.status !== 'ready' && redisClient.status !== 'connecting') {
    await redisClient.connect();
  }
}

async function teardownTestRedis(): Promise<void> {
  await redisClient.quit();
}

async function flushTestRedis(): Promise<void> {
  await redisClient.flushdb();
}

export {
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
};
