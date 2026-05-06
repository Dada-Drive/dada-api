const config = {
  server: {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  db: {
    url: process.env.DATABASE_URL || '',
    ssl: process.env.DB_SSL === 'true',
    poolMin: Number(process.env.DB_POOL_MIN) || 2,
    poolMax: Number(process.env.DB_POOL_MAX) || 10,
  },
  redis: {
    url: process.env.REDIS_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || '',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || ['*'],
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

export { config };
