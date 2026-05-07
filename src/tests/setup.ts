// Note: env vars are set by src/tests/env.ts (via jest.config.ts setupFiles)
// which runs BEFORE any module imports.

import http from 'http';

import { io as ioc } from 'socket.io-client';

import { redisClient } from '@/config/redis';
import { sequelize } from '@/models/index';
import { initializeSocketServer, shutdownSocketServer } from '@/sockets/socketServer';

import type { AppServer } from '@/sockets/socketAuth';
import type { Socket as ClientSocket } from 'socket.io-client';

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

// ── Socket.IO test helpers ──────────────────────────────────────────────────

async function setupTestSocketServer(): Promise<{
  io: AppServer;
  httpServer: http.Server;
  port: number;
}> {
  const httpServer = http.createServer();
  const io = await initializeSocketServer(httpServer);
  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ io, httpServer, port });
    });
  });
}

function createTestClient(port: number, namespace: string, token: string): ClientSocket {
  return ioc(`http://localhost:${port}${namespace}`, {
    auth: { token: `Bearer ${token}` },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
}

async function teardownTestSocketServer(httpServer: http.Server): Promise<void> {
  await shutdownSocketServer();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
}

function waitForEvent<T = unknown>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export {
  createTestClient,
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  setupTestSocketServer,
  teardownTestDatabase,
  teardownTestRedis,
  teardownTestSocketServer,
  truncateAllTables,
  waitForEvent,
};
