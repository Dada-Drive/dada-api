import { redisClient } from '@/config/redis';
import * as redisGeo from '@/services/redisGeoService';
import { ACTIVE_RIDE_PREFIX } from '@/sockets/socketAuth';
import { getIO } from '@/sockets/socketServer';
import { logger } from '@/utils/logger';

import type { VehicleType } from '@/types/enums';

// ── Constants ───────────────────────────────────────────────────────────────

const ACTIVE_RIDE_TTL = 86400; // 24h safety net

// ── Emit to User ────────────────────────────────────────────────────────────

function emitToUser(userId: string, event: string, payload: unknown): void {
  const io = getIO();
  if (!io) return;

  io.of('/riders')
    .to(`rider:${userId}`)
    .emit(event as 'ride:new_request', payload as never);
  io.of('/drivers')
    .to(`driver:${userId}`)
    .emit(event as 'ride:new_request', payload as never);
}

// ── Emit to Ride Room ───────────────────────────────────────────────────────

function emitToRideRoom(rideId: string, event: string, payload: unknown): void {
  const io = getIO();
  if (!io) return;

  io.of('/riders')
    .to(`ride:${rideId}`)
    .emit(event as 'ride:new_request', payload as never);
  io.of('/drivers')
    .to(`ride:${rideId}`)
    .emit(event as 'ride:new_request', payload as never);
}

// ── Emit to Nearby Drivers ──────────────────────────────────────────────────

async function emitToNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number,
  event: string,
  payload: unknown,
  vehicleType?: VehicleType,
): Promise<void> {
  const io = getIO();
  if (!io) return;

  try {
    const drivers = await redisGeo.getNearbyDrivers(lat, lng, radiusKm, vehicleType);
    const driversNs = io.of('/drivers');

    for (const driver of drivers) {
      driversNs.to(`driver:${driver.driverId}`).emit(event as 'ride:new_request', payload as never);
    }
  } catch (err) {
    logger.warn('emitToNearbyDrivers failed', {
      error: err instanceof Error ? err.message : String(err),
      component: 'socket-emitter',
    });
  }
}

// ── Join Ride Room ──────────────────────────────────────────────────────────

async function joinRideRoom(userId: string, rideId: string): Promise<void> {
  const io = getIO();
  if (!io) return;

  const room = `ride:${rideId}`;

  for (const nsPath of ['/riders', '/drivers'] as const) {
    const sockets = await io.of(nsPath).fetchSockets();
    for (const s of sockets) {
      if (s.data.user?.userId === userId) {
        await s.join(room);
      }
    }
  }

  try {
    await redisClient.setex(`${ACTIVE_RIDE_PREFIX}${userId}`, ACTIVE_RIDE_TTL, rideId);
  } catch (err) {
    logger.warn('joinRideRoom: failed to set active_ride key', {
      userId,
      rideId,
      error: err instanceof Error ? err.message : String(err),
      component: 'socket-emitter',
    });
  }
}

// ── Leave Ride Room ─────────────────────────────────────────────────────────

async function leaveRideRoom(userId: string, rideId: string): Promise<void> {
  const io = getIO();
  if (!io) return;

  const room = `ride:${rideId}`;

  for (const nsPath of ['/riders', '/drivers'] as const) {
    const sockets = await io.of(nsPath).fetchSockets();
    for (const s of sockets) {
      if (s.data.user?.userId === userId) {
        await s.leave(room);
      }
    }
  }

  try {
    await redisClient.del(`${ACTIVE_RIDE_PREFIX}${userId}`);
  } catch (err) {
    logger.warn('leaveRideRoom: failed to delete active_ride key', {
      userId,
      rideId,
      error: err instanceof Error ? err.message : String(err),
      component: 'socket-emitter',
    });
  }
}

export { emitToNearbyDrivers, emitToRideRoom, emitToUser, joinRideRoom, leaveRideRoom };
