import http from 'http';

import { redisClient } from '@/config/redis';
import { blacklistAllUserTokens, blacklistToken, generateAccessToken } from '@/services/jwtService';
import { createTestUser } from '@/tests/helpers/factories';
import {
  createTestClient,
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  setupTestSocketServer,
  teardownTestDatabase,
  teardownTestRedis,
  teardownTestSocketServer,
  truncateAllTables,
} from '@/tests/setup';
import { UserRole } from '@/types/enums';

import type { AppServer } from '@/sockets/socketAuth';
import type { Socket as ClientSocket } from 'socket.io-client';

let io: AppServer;
let httpServer: http.Server;
let port: number;

beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
  const setup = await setupTestSocketServer();
  io = setup.io;
  httpServer = setup.httpServer;
  port = setup.port;
});

afterAll(async () => {
  await teardownTestSocketServer(httpServer);
  await teardownTestDatabase();
  await teardownTestRedis();
});

beforeEach(async () => {
  await truncateAllTables();
  await flushTestRedis();
});

function connectAndWait(client: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connection timeout')), 3000);
    client.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    client.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    client.connect();
  });
}

describe('Socket Authentication', () => {
  describe('valid token', () => {
    it('connects rider to /riders namespace', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const { accessToken } = generateAccessToken(rider.id, UserRole.Rider);
      const client = createTestClient(port, '/riders', accessToken);

      await connectAndWait(client);
      expect(client.connected).toBe(true);
      client.disconnect();
    });

    it('connects driver to /drivers namespace', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const { accessToken } = generateAccessToken(driver.id, UserRole.Driver);
      const client = createTestClient(port, '/drivers', accessToken);

      await connectAndWait(client);
      expect(client.connected).toBe(true);
      client.disconnect();
    });
  });

  describe('invalid token', () => {
    it('rejects connection with no token', async () => {
      const client = createTestClient(port, '/riders', '');

      await expect(connectAndWait(client)).rejects.toThrow();
      client.disconnect();
    });

    it('rejects connection with malformed token', async () => {
      const client = createTestClient(port, '/riders', 'not-a-valid-jwt');

      await expect(connectAndWait(client)).rejects.toThrow();
      client.disconnect();
    });

    it('rejects connection with blacklisted token (jti)', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const { accessToken, jti } = generateAccessToken(rider.id, UserRole.Rider);
      await blacklistToken(jti, Math.floor(Date.now() / 1000) + 900);

      const client = createTestClient(port, '/riders', accessToken);
      await expect(connectAndWait(client)).rejects.toThrow();
      client.disconnect();
    });

    it('rejects connection with blacklisted user', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const { accessToken } = generateAccessToken(rider.id, UserRole.Rider);
      await blacklistAllUserTokens(rider.id);

      const client = createTestClient(port, '/riders', accessToken);
      await expect(connectAndWait(client)).rejects.toThrow();
      client.disconnect();
    });

    it('rejects connection for inactive user', async () => {
      const rider = await createTestUser({ role: UserRole.Rider, isActive: false });
      const { accessToken } = generateAccessToken(rider.id, UserRole.Rider);

      const client = createTestClient(port, '/riders', accessToken);
      await expect(connectAndWait(client)).rejects.toThrow();
      client.disconnect();
    });
  });

  describe('role enforcement', () => {
    it('rejects rider connecting to /drivers namespace', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const { accessToken } = generateAccessToken(rider.id, UserRole.Rider);
      const client = createTestClient(port, '/drivers', accessToken);

      await expect(connectAndWait(client)).rejects.toThrow();
      client.disconnect();
    });

    it('rejects driver connecting to /riders namespace', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const { accessToken } = generateAccessToken(driver.id, UserRole.Driver);
      const client = createTestClient(port, '/riders', accessToken);

      await expect(connectAndWait(client)).rejects.toThrow();
      client.disconnect();
    });
  });

  describe('auto-rejoin ride room', () => {
    it('auto-joins ride room when active_ride key exists', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const rideId = 'test-ride-123';

      await redisClient.setex(`active_ride:${rider.id}`, 86400, rideId);

      const { accessToken } = generateAccessToken(rider.id, UserRole.Rider);
      const client = createTestClient(port, '/riders', accessToken);

      await connectAndWait(client);

      // Verify socket is in the ride room by checking server-side
      const sockets = await io.of('/riders').fetchSockets();
      const riderSocket = sockets.find((s) => s.data.user?.userId === rider.id);
      expect(riderSocket?.rooms.has(`ride:${rideId}`)).toBe(true);

      client.disconnect();
    });
  });
});
