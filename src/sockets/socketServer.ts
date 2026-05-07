import http from 'http';

import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';

import { config } from '@/config/index';
import { createRedisClient } from '@/config/redis';
import { registerDriverHandlers } from '@/sockets/handlers/driverHandlers';
import { registerRiderHandlers } from '@/sockets/handlers/riderHandlers';
import { createSocketAuthMiddleware, startTokenExpiryCheck } from '@/sockets/socketAuth';
import { UserRole } from '@/types/enums';
import { logger } from '@/utils/logger';

import type { AppServer } from '@/sockets/socketAuth';
import type Redis from 'ioredis';

// ── Module State ────────────────────────────────────────────────────────────

let io: AppServer | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let tokenCheckInterval: NodeJS.Timeout | null = null;

// ── Initialize ──────────────────────────────────────────────────────────────

async function initializeSocketServer(httpServer: http.Server): Promise<AppServer> {
  const server = new Server(httpServer, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
    },
    transports: [...config.socket.transports],
    pingInterval: config.socket.pingInterval,
    pingTimeout: config.socket.pingTimeout,
  }) as AppServer;

  // Redis adapter for multi-instance pub/sub
  pubClient = createRedisClient();
  subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  server.adapter(createAdapter(pubClient, subClient));

  // Auth middleware per namespace
  const ridersNs = server.of('/riders');
  const driversNs = server.of('/drivers');

  const riderAuth = createSocketAuthMiddleware([UserRole.Rider, UserRole.Admin]);
  const driverAuth = createSocketAuthMiddleware([UserRole.Driver, UserRole.Admin]);
  ridersNs.use((socket, next) => void riderAuth(socket, next));
  driversNs.use((socket, next) => void driverAuth(socket, next));

  // Register handlers
  registerRiderHandlers(ridersNs);
  registerDriverHandlers(driversNs);

  // Periodic token expiry check
  tokenCheckInterval = startTokenExpiryCheck(server, config.socket.tokenCheckIntervalMs);

  logger.info('Socket.IO server initialized with Redis adapter', { component: 'socket' });
  io = server;
  return server;
}

// ── Singleton Accessor ──────────────────────────────────────────────────────

function getIO(): AppServer | null {
  return io;
}

// ── Shutdown ────────────────────────────────────────────────────────────────

async function shutdownSocketServer(): Promise<void> {
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
    tokenCheckInterval = null;
  }

  if (io) {
    await io.close();
    io = null;
  }

  if (pubClient || subClient) {
    const pub = pubClient;
    const sub = subClient;
    pubClient = null;
    subClient = null;
    await Promise.all([pub?.quit(), sub?.quit()]);
  }

  logger.info('Socket.IO server shut down', { component: 'socket' });
}

export { getIO, initializeSocketServer, shutdownSocketServer };
