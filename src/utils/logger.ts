import { AsyncLocalStorage } from 'async_hooks';

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// AsyncLocalStorage for correlation ID propagation
const correlationStore = new AsyncLocalStorage<{ requestId: string }>();

function getCorrelationId(): string | undefined {
  return correlationStore.getStore()?.requestId;
}

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

// Custom format that includes correlation ID
const correlationFormat = winston.format((info) => {
  const correlationId = getCorrelationId();
  if (correlationId) {
    info.correlationId = correlationId;
  }
  return info;
});

// Human-readable format for development
const devFormat = combine(
  correlationFormat(),
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize(),
  printf(({ level, message, timestamp: ts, correlationId, stack, ...meta }) => {
    const corrId = correlationId ? ` [${correlationId as string}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack as string}` : '';
    return `${ts as string} ${level}${corrId}: ${message as string}${metaStr}${stackStr}`;
  }),
);

// JSON format for production
const prodFormat = combine(correlationFormat(), errors({ stack: true }), timestamp(), json());

const nodeEnv = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

const transports: winston.transport[] = [];

// Console transport — always active
transports.push(
  new winston.transports.Console({
    format: nodeEnv === 'development' ? devFormat : prodFormat,
  }),
);

// File transport — daily rotation with 30-day retention
if (nodeEnv !== 'test') {
  transports.push(
    new DailyRotateFile({
      dirname: 'logs',
      filename: 'dada-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      format: prodFormat,
    }),
  );

  transports.push(
    new DailyRotateFile({
      dirname: 'logs',
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      level: 'error',
      format: prodFormat,
    }),
  );
}

const logger = winston.createLogger({
  level: logLevel,
  levels: winston.config.npm.levels,
  transports,
  exitOnError: false,
});

export { logger, correlationStore, getCorrelationId };
