// This file sets test environment variables BEFORE any modules load.
// It must be listed in jest.config.ts setupFiles (not setupFilesAfterFramework).

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://dada_test:dada_test@localhost:5433/dada_test';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN = '30d';
process.env.PORT = '3001';
process.env.ALLOWED_ORIGINS = 'http://localhost:3001';
process.env.LOG_LEVEL = 'error';
