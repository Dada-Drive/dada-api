import http from 'http';

import { redisClient } from '@/config/redis';
import { generateAccessToken } from '@/services/jwtService';
import { joinRideRoom } from '@/sockets/emitter';
import {
  createTestDriverProfile,
  createTestUser,
  createTestVehicle,
} from '@/tests/helpers/factories';
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
import { UserRole, VehicleType } from '@/types/enums';

import type { AppServer } from '@/sockets/socketAuth';
import type { AckResponse } from '@/sockets/socketTypes';
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

function emitWithAck(client: ClientSocket, event: string, payload: unknown): Promise<AckResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Ack timeout')), 3000);
    client.emit(event, payload, (response: AckResponse) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

describe('Location Update Handler', () => {
  describe('coordinate validation', () => {
    it('rejects lat outside -90 to 90 range', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const profile = await createTestDriverProfile(driver.id, { isApproved: true });
      await createTestVehicle(profile.id);

      // Set driver metadata so location handler can read it
      await redisClient.hset(`driver:${driver.id}:meta`, {
        vehicleType: VehicleType.Economy,
        rating: '4.5',
        fullName: 'Driver',
      });

      const { accessToken } = generateAccessToken(driver.id, UserRole.Driver);
      const client = createTestClient(port, '/drivers', accessToken);
      await connectClient(client);

      const response = await emitWithAck(client, 'location:update', { lat: 91, lng: 10 });
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid coordinates');
      client.disconnect();
    });

    it('rejects lng outside -180 to 180 range', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const profile = await createTestDriverProfile(driver.id, { isApproved: true });
      await createTestVehicle(profile.id);
      await redisClient.hset(`driver:${driver.id}:meta`, {
        vehicleType: VehicleType.Economy,
        rating: '4.5',
        fullName: 'Driver',
      });

      const { accessToken } = generateAccessToken(driver.id, UserRole.Driver);
      const client = createTestClient(port, '/drivers', accessToken);
      await connectClient(client);

      const response = await emitWithAck(client, 'location:update', { lat: 36, lng: 181 });
      expect(response.success).toBe(false);
      client.disconnect();
    });

    it('acks success for valid coordinates', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const profile = await createTestDriverProfile(driver.id, { isApproved: true });
      await createTestVehicle(profile.id);
      await redisClient.hset(`driver:${driver.id}:meta`, {
        vehicleType: VehicleType.Economy,
        rating: '4.5',
        fullName: 'Driver',
      });

      const { accessToken } = generateAccessToken(driver.id, UserRole.Driver);
      const client = createTestClient(port, '/drivers', accessToken);
      await connectClient(client);

      const response = await emitWithAck(client, 'location:update', { lat: 36.8, lng: 10.18 });
      expect(response.success).toBe(true);
      client.disconnect();
    });
  });

  describe('Redis geo update', () => {
    it('updates driver position in Redis geo index', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const profile = await createTestDriverProfile(driver.id, { isApproved: true });
      await createTestVehicle(profile.id);
      await redisClient.hset(`driver:${driver.id}:meta`, {
        vehicleType: VehicleType.Economy,
        rating: '4.5',
        fullName: 'Driver',
      });

      const { accessToken } = generateAccessToken(driver.id, UserRole.Driver);
      const client = createTestClient(port, '/drivers', accessToken);
      await connectClient(client);

      await emitWithAck(client, 'location:update', { lat: 36.8065, lng: 10.1815 });

      // Verify geo position
      const pos = await redisClient.geopos('drivers:online', driver.id);
      expect(pos[0]).not.toBeNull();
      client.disconnect();
    });
  });

  describe('ride room broadcast', () => {
    it('broadcasts driver location to rider in ride room', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const rider = await createTestUser({ role: UserRole.Rider });
      const profile = await createTestDriverProfile(driver.id, { isApproved: true });
      await createTestVehicle(profile.id);
      await redisClient.hset(`driver:${driver.id}:meta`, {
        vehicleType: VehicleType.Economy,
        rating: '4.5',
        fullName: 'Driver',
      });

      const rideId = 'active-ride-loc';

      const { accessToken: driverToken } = generateAccessToken(driver.id, UserRole.Driver);
      const { accessToken: riderToken } = generateAccessToken(rider.id, UserRole.Rider);

      const driverClient = createTestClient(port, '/drivers', driverToken);
      const riderClient = createTestClient(port, '/riders', riderToken);

      await Promise.all([connectClient(driverClient), connectClient(riderClient)]);

      // Join ride room
      await joinRideRoom(rider.id, rideId);
      await joinRideRoom(driver.id, rideId);
      await new Promise((r) => setTimeout(r, 100));

      const locationPromise = waitForEvent(riderClient, 'ride:driver_location');

      await emitWithAck(driverClient, 'location:update', { lat: 36.81, lng: 10.19 });

      const locData = (await locationPromise) as { driverId: string; lat: number; lng: number };
      expect(locData.driverId).toBe(driver.id);
      expect(locData.lat).toBe(36.81);
      expect(locData.lng).toBe(10.19);

      driverClient.disconnect();
      riderClient.disconnect();
    });

    it('does not broadcast when driver has no active ride', async () => {
      const driver = await createTestUser({ role: UserRole.Driver });
      const rider = await createTestUser({ role: UserRole.Rider });
      const profile = await createTestDriverProfile(driver.id, { isApproved: true });
      await createTestVehicle(profile.id);
      await redisClient.hset(`driver:${driver.id}:meta`, {
        vehicleType: VehicleType.Economy,
        rating: '4.5',
        fullName: 'Driver',
      });

      const { accessToken: driverToken } = generateAccessToken(driver.id, UserRole.Driver);
      const { accessToken: riderToken } = generateAccessToken(rider.id, UserRole.Rider);

      const driverClient = createTestClient(port, '/drivers', driverToken);
      const riderClient = createTestClient(port, '/riders', riderToken);

      await Promise.all([connectClient(driverClient), connectClient(riderClient)]);

      let riderReceived = false;
      riderClient.on('ride:driver_location', () => {
        riderReceived = true;
      });

      await emitWithAck(driverClient, 'location:update', { lat: 36.81, lng: 10.19 });
      await new Promise((r) => setTimeout(r, 300));

      expect(riderReceived).toBe(false);

      driverClient.disconnect();
      riderClient.disconnect();
    });
  });
});
