import http from 'http';

import { redisClient } from '@/config/redis';
import { generateAccessToken } from '@/services/jwtService';
import { updateDriverLocation } from '@/services/redisGeoService';
import {
  emitToNearbyDrivers,
  emitToRideRoom,
  emitToUser,
  joinRideRoom,
  leaveRideRoom,
} from '@/sockets/emitter';
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
  waitForEvent,
} from '@/tests/setup';
import { VehicleType, UserRole } from '@/types/enums';

import type { AppServer } from '@/sockets/socketAuth';
import type { Socket as ClientSocket } from 'socket.io-client';

let _io: AppServer;
let httpServer: http.Server;
let port: number;

beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
  const setup = await setupTestSocketServer();
  _io = setup.io;
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

function connectClient(client: ClientSocket): Promise<void> {
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

describe('Socket Event Propagation', () => {
  describe('emitToUser', () => {
    it('rider receives event via personal room', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const { accessToken } = generateAccessToken(rider.id, UserRole.Rider);
      const client = createTestClient(port, '/riders', accessToken);
      await connectClient(client);

      const eventPromise = waitForEvent(client, 'ride:new_offer');
      emitToUser(rider.id, 'ride:new_offer', {
        rideId: 'r1',
        offerId: 'o1',
        driverId: 'd1',
        driverName: 'Driver',
        driverRating: 4.5,
        vehicleType: 'economy',
        offeredFare: 10,
      });

      const data = await eventPromise;
      expect(data).toHaveProperty('rideId', 'r1');
      client.disconnect();
    });

    it('driver receives event via personal room', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const { accessToken } = generateAccessToken(driver.id, UserRole.Driver);
      const client = createTestClient(port, '/drivers', accessToken);
      await connectClient(client);

      const eventPromise = waitForEvent(client, 'ride:accepted');
      emitToUser(driver.id, 'ride:accepted', {
        rideId: 'r1',
        riderId: 'rid1',
        riderName: 'Rider',
        pickupLat: 36.8,
        pickupLng: 10.1,
        pickupAddress: 'Tunis',
        dropoffAddress: 'La Marsa',
      });

      const data = await eventPromise;
      expect(data).toHaveProperty('rideId', 'r1');
      client.disconnect();
    });
  });

  describe('emitToRideRoom', () => {
    it('both rider and driver receive ride room events', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const driver = await createTestUser({ role: UserRole.Driver });
      const rideId = 'test-ride-456';

      const { accessToken: riderToken } = generateAccessToken(rider.id, UserRole.Rider);
      const { accessToken: driverToken } = generateAccessToken(driver.id, UserRole.Driver);

      const riderClient = createTestClient(port, '/riders', riderToken);
      const driverClient = createTestClient(port, '/drivers', driverToken);

      await Promise.all([connectClient(riderClient), connectClient(driverClient)]);

      // Join ride room
      await joinRideRoom(rider.id, rideId);
      await joinRideRoom(driver.id, rideId);

      // Small delay for room join to propagate
      await new Promise((r) => setTimeout(r, 100));

      const riderPromise = waitForEvent(riderClient, 'ride:status_changed');
      const driverPromise = waitForEvent(driverClient, 'ride:status_changed');

      emitToRideRoom(rideId, 'ride:status_changed', {
        rideId,
        status: 'in_progress',
        timestamp: new Date().toISOString(),
      });

      const [riderData, driverData] = await Promise.all([riderPromise, driverPromise]);
      expect(riderData).toHaveProperty('status', 'in_progress');
      expect(driverData).toHaveProperty('status', 'in_progress');

      riderClient.disconnect();
      driverClient.disconnect();
    });

    it('non-participant does not receive ride room events', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const outsider = await createTestUser({ role: UserRole.Rider });
      const rideId = 'test-ride-789';

      const { accessToken: riderToken } = generateAccessToken(rider.id, UserRole.Rider);
      const { accessToken: outsiderToken } = generateAccessToken(outsider.id, UserRole.Rider);

      const riderClient = createTestClient(port, '/riders', riderToken);
      const outsiderClient = createTestClient(port, '/riders', outsiderToken);

      await Promise.all([connectClient(riderClient), connectClient(outsiderClient)]);
      await joinRideRoom(rider.id, rideId);
      await new Promise((r) => setTimeout(r, 100));

      let outsiderReceived = false;
      outsiderClient.on('ride:status_changed', () => {
        outsiderReceived = true;
      });

      const riderPromise = waitForEvent(riderClient, 'ride:status_changed');
      emitToRideRoom(rideId, 'ride:status_changed', {
        rideId,
        status: 'completed',
        timestamp: new Date().toISOString(),
      });

      await riderPromise;
      await new Promise((r) => setTimeout(r, 200));
      expect(outsiderReceived).toBe(false);

      riderClient.disconnect();
      outsiderClient.disconnect();
    });
  });

  describe('emitToNearbyDrivers', () => {
    it('nearby drivers receive event', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const { accessToken } = generateAccessToken(driver.id, UserRole.Driver);

      // Add driver to geo index
      await updateDriverLocation(driver.id, 36.8065, 10.1815, {
        vehicleType: VehicleType.Economy,
        rating: 4.5,
        fullName: 'Driver',
      });

      const client = createTestClient(port, '/drivers', accessToken);
      await connectClient(client);

      const eventPromise = waitForEvent(client, 'ride:new_request');
      await emitToNearbyDrivers(36.807, 10.182, 5, 'ride:new_request', {
        rideId: 'r1',
        pickupLat: 36.807,
        pickupLng: 10.182,
        pickupAddress: 'Tunis',
        dropoffAddress: 'La Marsa',
        vehicleType: 'economy',
        calculatedFare: 10,
        riderName: 'Rider',
      });

      const data = await eventPromise;
      expect(data).toHaveProperty('rideId', 'r1');
      client.disconnect();
    });
  });

  describe('joinRideRoom + leaveRideRoom lifecycle', () => {
    it('sets and deletes active_ride Redis key', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const rideId = 'lifecycle-ride';

      const { accessToken } = generateAccessToken(rider.id, UserRole.Rider);
      const client = createTestClient(port, '/riders', accessToken);
      await connectClient(client);

      await joinRideRoom(rider.id, rideId);
      const key = await redisClient.get(`active_ride:${rider.id}`);
      expect(key).toBe(rideId);

      await leaveRideRoom(rider.id, rideId);
      const keyAfter = await redisClient.get(`active_ride:${rider.id}`);
      expect(keyAfter).toBeNull();

      client.disconnect();
    });
  });
});
