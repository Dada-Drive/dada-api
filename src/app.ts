import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { config } from '@/config/index';
import { swaggerSpec } from '@/config/swagger';
import { correlationId } from '@/middlewares/correlationId';
import { errorHandler } from '@/middlewares/errorHandler';
import { notFound } from '@/middlewares/notFound';
import { authRoutes } from '@/routes/authRoutes';
import { healthRoutes } from '@/routes/healthRoutes';
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

// Routes
app.use(healthRoutes);
app.use('/api/v1/auth', authRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export { app };
