import * as redisGeo from '@/services/redisGeoService';
import { logger } from '@/utils/logger';
import { isValidCoordinates } from '@/utils/validation';

import type {
  AckResponse,
  ClientToServerEvents,
  InterServerEvents,
  NearbySubscribePayload,
  ServerToClientEvents,
  SocketData,
} from '@/sockets/socketTypes';
import type { Namespace, Socket } from 'socket.io';

type AppNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ── Nearby Watcher State ───────────────────────────────────────────────────

interface WatcherParams {
  lat: number;
  lng: number;
  radiusKm: number;
  socketId: string;
}

const MAX_RADIUS_KM = 10;
const TICK_INTERVAL_MS = 5_000;

const watchers = new Map<string, WatcherParams>();

// ── Push Nearby Drivers to a Single Watcher ────────────────────────────────

async function pushNearbyDrivers(
  namespace: AppNamespace,
  userId: string,
  params: WatcherParams,
): Promise<void> {
  const drivers = await redisGeo.getNearbyDrivers(params.lat, params.lng, params.radiusKm);

  namespace.to(`rider:${userId}`).emit('nearby:drivers', {
    drivers: drivers.map((d) => ({
      id: d.driverId,
      lat: d.lat,
      lng: d.lng,
      vehicleType: d.vehicleType,
      heading: d.heading,
    })),
  });
}

// ── Server-Side Tick ───────────────────────────────────────────────────────

function startNearbyTick(namespace: AppNamespace): void {
  setInterval(() => {
    if (watchers.size === 0) return;

    const entries = [...watchers.entries()];
    void Promise.allSettled(
      entries.map(([userId, params]) => pushNearbyDrivers(namespace, userId, params)),
    );
  }, TICK_INTERVAL_MS);
}

// ── Rider Namespace Handlers ───────────────────────────────────────────────

function registerRiderHandlers(namespace: AppNamespace): void {
  startNearbyTick(namespace);

  namespace.on('connection', (socket: AppSocket) => {
    const { userId } = socket.data.user;

    logger.info('Rider connected', {
      userId,
      socketId: socket.id,
      component: 'socket',
    });

    // ── nearby:subscribe ─────────────────────────────────────────────────

    socket.on(
      'nearby:subscribe',
      async (payload: NearbySubscribePayload, ack: (res: AckResponse) => void) => {
        try {
          const { lat, lng, radiusKm } = payload;

          if (!isValidCoordinates(lat, lng)) {
            ack({ success: false, error: 'Invalid coordinates' });
            return;
          }

          const clampedRadius = Math.min(Math.max(radiusKm, 0.1), MAX_RADIUS_KM);

          watchers.set(userId, {
            lat,
            lng,
            radiusKm: clampedRadius,
            socketId: socket.id,
          });

          logger.info('Rider subscribed to nearby drivers', {
            userId,
            lat,
            lng,
            radiusKm: clampedRadius,
            component: 'socket',
          });

          // Push immediate first batch
          await pushNearbyDrivers(namespace, userId, {
            lat,
            lng,
            radiusKm: clampedRadius,
            socketId: socket.id,
          });

          ack({ success: true });
        } catch (err) {
          logger.warn('nearby:subscribe handler error', {
            userId,
            error: err instanceof Error ? err.message : String(err),
            component: 'socket',
          });
          ack({ success: false, error: 'Internal error' });
        }
      },
    );

    // ── nearby:unsubscribe ───────────────────────────────────────────────

    socket.on(
      'nearby:unsubscribe',
      (_payload: Record<string, never>, ack: (res: AckResponse) => void) => {
        watchers.delete(userId);

        logger.info('Rider unsubscribed from nearby drivers', {
          userId,
          component: 'socket',
        });

        ack({ success: true });
      },
    );

    // ── disconnect ───────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      watchers.delete(userId);

      logger.info('Rider disconnected', {
        userId,
        socketId: socket.id,
        reason,
        component: 'socket',
      });
    });
  });
}

export { registerRiderHandlers };
