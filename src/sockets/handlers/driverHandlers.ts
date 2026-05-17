import { config } from '@/config/index';
import { redisClient } from '@/config/redis';
import { DriverProfile } from '@/models/index';
import * as driverService from '@/services/driverService';
import * as redisGeo from '@/services/redisGeoService';
import { ACTIVE_RIDE_PREFIX } from '@/sockets/socketAuth';
import { VehicleType } from '@/types/enums';
import { logger } from '@/utils/logger';
import { isValidCoordinates } from '@/utils/validation';

import type {
  ClientToServerEvents,
  InterServerEvents,
  LocationUpdatePayload,
  ServerToClientEvents,
  SocketData,
} from '@/sockets/socketTypes';
import type { Namespace } from 'socket.io';

type AppNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ── DB Write Debounce ───────────────────────────────────────────────────────

const lastDbWrite = new Map<string, number>();

// ── Driver Namespace Handlers ───────────────────────────────────────────────

function registerDriverHandlers(namespace: AppNamespace): void {
  namespace.on('connection', (socket) => {
    const { userId } = socket.data.user;

    logger.info('Driver connected', {
      userId,
      socketId: socket.id,
      component: 'socket',
    });

    // ── location:update ─────────────────────────────────────────────────

    socket.on('location:update', async (payload: LocationUpdatePayload, ack) => {
      try {
        const { lat, lng, heading } = payload;

        if (!isValidCoordinates(lat, lng)) {
          ack({ success: false, error: 'Invalid coordinates' });
          return;
        }

        // Fetch metadata from Redis (already stored by updateDriverLocation)
        const metaKey = `driver:${userId}:meta`;
        const meta = await redisClient.hgetall(metaKey);

        // Update Redis geo index immediately
        await redisGeo.updateDriverLocation(userId, lat, lng, {
          vehicleType: (meta.vehicleType as VehicleType) || VehicleType.Economy,
          serviceTypes: meta.serviceTypes || '',
          rating: meta.rating ? parseFloat(meta.rating) : null,
          fullName: meta.fullName || '',
          heading,
        });

        // Debounced DB write
        const now = Date.now();
        const lastWrite = lastDbWrite.get(userId) ?? 0;
        if (now - lastWrite >= config.socket.locationDbWriteIntervalMs) {
          lastDbWrite.set(userId, now);
          await DriverProfile.update(
            { lastLat: lat, lastLng: lng, lastSeenAt: new Date() },
            { where: { userId } },
          );
        }

        // Broadcast to ride room if in active ride
        const activeRideId = await redisClient.get(`${ACTIVE_RIDE_PREFIX}${userId}`);
        if (activeRideId) {
          const ridersNs = socket.nsp.server.of('/riders');
          ridersNs.to(`ride:${activeRideId}`).emit('ride:driver_location', {
            driverId: userId,
            lat,
            lng,
            heading,
            timestamp: new Date().toISOString(),
          });
        }

        ack({ success: true });
      } catch (err) {
        logger.warn('location:update handler error', {
          userId,
          error: err instanceof Error ? err.message : String(err),
          component: 'socket',
        });
        ack({ success: false, error: 'Internal error' });
      }
    });

    // ── driver:status ───────────────────────────────────────────────────

    socket.on('driver:status', async (payload, ack) => {
      try {
        await driverService.toggleOnlineStatus(userId, payload.isOnline);
        ack({ success: true });
      } catch (err) {
        logger.warn('driver:status handler error', {
          userId,
          error: err instanceof Error ? err.message : String(err),
          component: 'socket',
        });
        ack({ success: false, error: 'Failed to update status' });
      }
    });

    // ── disconnect ──────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      lastDbWrite.delete(userId);
      logger.info('Driver disconnected', {
        userId,
        socketId: socket.id,
        reason,
        component: 'socket',
      });

      // Remove driver from geo index so riders stop seeing them
      redisGeo.removeDriver(userId).catch((err) => {
        logger.warn('Failed to remove driver from geo on disconnect', {
          userId,
          error: err instanceof Error ? err.message : String(err),
          component: 'socket',
        });
      });

      // Mark offline in DB (fire-and-forget)
      DriverProfile.update(
        { isOnline: false, lastSeenAt: new Date() },
        { where: { userId } },
      ).catch((err) => {
        logger.warn('Failed to mark driver offline on disconnect', {
          userId,
          error: err instanceof Error ? err.message : String(err),
          component: 'socket',
        });
      });
    });
  });
}

export { registerDriverHandlers };
