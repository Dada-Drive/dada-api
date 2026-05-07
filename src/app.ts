import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { config } from '@/config/index';
import { swaggerSpec } from '@/config/swagger';
import { setupBullBoard } from '@/jobs/bullBoard';
import { protect, restrictTo } from '@/middlewares/auth';
import { correlationId } from '@/middlewares/correlationId';
import { errorHandler } from '@/middlewares/errorHandler';
import { notFound } from '@/middlewares/notFound';
import { adminRoutes } from '@/routes/adminRoutes';
import { authRoutes } from '@/routes/authRoutes';
import { driverRoutes } from '@/routes/driverRoutes';
import { healthRoutes } from '@/routes/healthRoutes';
import { metaRoutes } from '@/routes/metaRoutes';
import { notificationRoutes } from '@/routes/notificationRoutes';
import { ratingRoutes } from '@/routes/ratingRoutes';
import { rideRoutes } from '@/routes/rideRoutes';
import { rideStopRoutes } from '@/routes/rideStopRoutes';
import { sharedRideRoutes } from '@/routes/sharedRideRoutes';
import { uploadRoutes } from '@/routes/uploadRoutes';
import { userRoutes } from '@/routes/userRoutes';
import { vehicleCatalogRoutes } from '@/routes/vehicleCatalogRoutes';
import { walletRoutes } from '@/routes/walletRoutes';
import { UserRole } from '@/types/enums';
import { logger } from '@/utils/logger';

const app = express();

// Security headers
app.use(helmet());

// Remove X-Powered-By
app.disable('x-powered-by');

// CORS
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
);

// Correlation ID — must be before morgan so request ID is available for logging
app.use(correlationId);

// HTTP request logging via Morgan piped through Winston
const morganStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: morganStream,
  }),
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Swagger UI — development and staging only
if (config.server.nodeEnv !== 'production') {
  app.get('/api/spec.json', (_req, res) => {
    res.json(swaggerSpec);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// API version header
app.use('/api/v1', (_req, res, next) => {
  res.setHeader('X-API-Version', 'v1');
  next();
});

// Routes
app.use(healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/driver', driverRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/rides/:id/stops', rideStopRoutes);
app.use('/api/v1/shared-rides', sharedRideRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/ratings', ratingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/vehicles', vehicleCatalogRoutes);
app.use('/api/v1/meta', metaRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/upload', uploadRoutes);

// Bull Board — admin-only queue monitoring dashboard
if (config.server.nodeEnv !== 'production') {
  const bullBoardAdapter = setupBullBoard();
  app.use('/admin/queues', protect, restrictTo(UserRole.Admin), bullBoardAdapter.getRouter());
}

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export { app };
