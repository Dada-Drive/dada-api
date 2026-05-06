import 'dotenv/config';

import http from 'http';

import { app } from '@/app';
import { config } from '@/config/index';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { validateEnv } from '@/config/validateEnv';
import { initializeDatabase, sequelize } from '@/models/index';
import { logger } from '@/utils/logger';

// Validate environment variables before anything else
validateEnv();

async function startServer(): Promise<void> {
  // Connect to database and Redis before accepting requests
  await initializeDatabase();
  await connectRedis();

  const server = http.createServer(app);
  const PORT = config.server.port;

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
      env: config.server.nodeEnv,
      port: PORT,
    });
    if (config.server.nodeEnv !== 'production') {
      logger.info(`Swagger UI available at http://localhost:${PORT}/docs`);
    }
  });

  // Graceful shutdown
  function gracefulShutdown(signal: string): void {
    logger.info(`${signal} received — starting graceful shutdown`);

    server.close(() => {
      logger.info('HTTP server closed');

      Promise.all([sequelize.close(), disconnectRedis()])
        .then(() => {
          logger.info('Database and Redis connections closed');
          logger.info('Graceful shutdown complete');
          process.exit(0);
        })
        .catch((err: unknown) => {
          logger.error('Error during shutdown', {
            error: err instanceof Error ? err.message : String(err),
          });
          process.exit(1);
        });
    });

    // Force exit after 10 seconds if connections are not drained
    setTimeout(() => {
      logger.error('Forced shutdown — connections not drained within timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Unhandled rejections — log and exit
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection', { reason });
  process.exit(1);
});

// Uncaught exceptions — log and exit
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { message: error.message, stack: error.stack });
  process.exit(1);
});

startServer().catch((error: unknown) => {
  logger.error('Failed to start server', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
