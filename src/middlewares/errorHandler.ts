import { Request, Response, NextFunction } from 'express';
import {
  ConnectionError,
  DatabaseError,
  ForeignKeyConstraintError,
  TimeoutError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize';

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

  // Sequelize validation errors (model-level validate:{})
  if (err instanceof SequelizeValidationError) {
    const details = err.errors.map((e) => ({ field: e.path, message: e.message }));

    logger.warn('Validation error', {
      path: req.path,
      method: req.method,
      details,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      },
    });
    return;
  }

  // Unique constraint violations (duplicate email, phone, etc.)
  if (err instanceof UniqueConstraintError) {
    const fields = Object.keys(err.fields || {});

    logger.warn('Unique constraint violation', {
      path: req.path,
      method: req.method,
      fields,
    });

    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: `A record with this ${fields.join(', ')} already exists`,
        details: { fields },
      },
    });
    return;
  }

  // FK constraint violations (referencing non-existent record)
  if (err instanceof ForeignKeyConstraintError) {
    logger.warn('Foreign key constraint violation', {
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'REFERENCE_ERROR',
        message: 'Referenced record does not exist',
      },
    });
    return;
  }

  // Database connection/timeout errors
  if (err instanceof ConnectionError || err instanceof TimeoutError) {
    logger.error('Database connection error', {
      message: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service temporarily unavailable',
      },
    });
    return;
  }

  // Other database errors (CHECK constraint violations, etc.)
  if (err instanceof DatabaseError) {
    if (err.message.includes('check') || err.message.includes('violates check constraint')) {
      logger.warn('Check constraint violation', {
        path: req.path,
        method: req.method,
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Operation violates a data constraint',
        },
      });
      return;
    }

    logger.error('Database error', {
      message: err.message,
      path: req.path,
      method: req.method,
    });
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
