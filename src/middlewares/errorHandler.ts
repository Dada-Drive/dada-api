import { Request, Response, NextFunction } from 'express';

import { config } from '@/config/index';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';

function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Operational errors (expected)
  if (err instanceof AppError) {
    logger.warn(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      details: err.details,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // Unexpected errors
  logger.error('Unhandled error', {
    message: err.message,
    stack: config.server.nodeEnv === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        config.server.nodeEnv === 'development' ? err.message : 'An unexpected error occurred',
    },
  });
}

export { errorHandler };
