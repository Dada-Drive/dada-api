import { logger } from '@/utils/logger';

import type {
  ClientToServerEvents,
  InterServerEvents,
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

// ── Rider Namespace Handlers ────────────────────────────────────────────────

function registerRiderHandlers(namespace: AppNamespace): void {
  namespace.on('connection', (socket) => {
    const { userId } = socket.data.user;

    logger.info('Rider connected', {
      userId,
      socketId: socket.id,
      component: 'socket',
    });

    socket.on('disconnect', (reason) => {
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
