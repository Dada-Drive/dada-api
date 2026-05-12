import { redisClient } from '@/config/redis';
import { User } from '@/models/index';
import { cacheUser, getCachedUser, isBlacklisted, verifyAccessToken } from '@/services/jwtService';
import { UserRole } from '@/types/enums';

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@/sockets/socketTypes';
import type { Server, Socket } from 'socket.io';

// ── Types ───────────────────────────────────────────────────────────────────

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const ACTIVE_RIDE_PREFIX = 'active_ride:';

// ── Auth Middleware Factory ─────────────────────────────────────────────────

function createSocketAuthMiddleware(
  allowedRoles: UserRole[],
): (socket: AppSocket, next: (err?: Error) => void) => Promise<void> {
  return async (socket: AppSocket, next: (err?: Error) => void): Promise<void> => {
    try {
      // 1. Extract token (auth object preferred, query fallback for Socket.IO-Client-Swift)
      const raw = (socket.handshake.auth.token ?? socket.handshake.query.token) as
        | string
        | undefined;
      if (!raw) {
        next(new Error('Authentication required'));
        return;
      }
      const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;

      // 2. Verify JWT
      const payload = verifyAccessToken(token);

      // 3. Check blacklist
      const blacklisted = await isBlacklisted(payload.jti, payload.userId);
      if (blacklisted) {
        next(new Error('Token revoked'));
        return;
      }

      // 4. Load user from cache or DB
      const cached = await getCachedUser(payload.userId);
      let role: UserRole;

      if (cached) {
        const userData = JSON.parse(cached) as { isActive: boolean; role: UserRole };
        if (!userData.isActive) {
          next(new Error('Account suspended'));
          return;
        }
        role = userData.role;
      } else {
        const user = await User.findByPk(payload.userId, {
          attributes: ['id', 'role', 'isActive'],
        });
        if (!user) {
          next(new Error('Account not found'));
          return;
        }
        if (!user.isActive) {
          next(new Error('Account suspended'));
          return;
        }
        role = user.role;
        await cacheUser(payload.userId, JSON.stringify({ isActive: user.isActive, role }));
      }

      // 5. Role gate
      if (!allowedRoles.includes(role)) {
        next(new Error('Unauthorized namespace'));
        return;
      }

      // 6. Attach data + join personal room
      socket.data.user = { userId: payload.userId, role };
      socket.data.tokenExp = payload.exp;
      socket.data.tokenJti = payload.jti;

      const personalRoom =
        role === UserRole.Driver ? `driver:${payload.userId}` : `rider:${payload.userId}`;
      await socket.join(personalRoom);

      // 7. Auto-rejoin active ride room
      const activeRideId = await redisClient.get(`${ACTIVE_RIDE_PREFIX}${payload.userId}`);
      if (activeRideId) {
        await socket.join(`ride:${activeRideId}`);
      }

      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  };
}

// ── Periodic Token Expiry Check ─────────────────────────────────────────────

function startTokenExpiryCheck(io: AppServer, intervalMs: number): NodeJS.Timeout {
  const callback = async (): Promise<void> => {
    const now = Math.floor(Date.now() / 1000);
    const namespaces = [io.of('/riders'), io.of('/drivers')];

    for (const ns of namespaces) {
      const sockets = await ns.fetchSockets();

      for (const s of sockets) {
        const data = s.data as SocketData | undefined;
        if (!data?.user) continue;

        if (data.tokenExp < now) {
          s.disconnect(true);
          continue;
        }

        const blacklisted = await isBlacklisted(data.tokenJti, data.user.userId);
        if (blacklisted) {
          s.disconnect(true);
        }
      }
    }
  };

  return setInterval(() => void callback(), intervalMs);
}

export { ACTIVE_RIDE_PREFIX, createSocketAuthMiddleware, startTokenExpiryCheck };
export type { AppServer, AppSocket };
