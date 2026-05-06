import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';

import { setupTestRedis, teardownTestRedis, flushTestRedis } from '@/tests/setup';

// Create a test app with a very low limit (no Redis store — in-memory for this test)
function createTestApp() {
  const app = express();

  const testLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests — please try again later',
        },
      });
    },
  });

  app.get('/test', testLimiter, (_req: Request, res: Response) => {
    res.status(200).json({ success: true });
  });

  return app;
}

beforeAll(async () => {
  await setupTestRedis();
});

afterAll(async () => {
  await teardownTestRedis();
});

beforeEach(async () => {
  await flushTestRedis();
});

describe('rateLimiter middleware', () => {
  it('allows requests within the limit', async () => {
    const app = createTestApp();

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding the limit', async () => {
    const app = createTestApp();

    // Make 3 requests (within limit)
    for (let i = 0; i < 3; i++) {
      await request(app).get('/test');
    }

    // 4th request should be rate limited
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('includes rate limit headers', async () => {
    const app = createTestApp();

    const res = await request(app).get('/test');
    // draft-7 headers are lowercase
    const headerKeys = Object.keys(res.headers);
    const hasRateLimitHeader = headerKeys.some((h) => h.toLowerCase().includes('ratelimit'));
    expect(hasRateLimitHeader).toBe(true);
  });
});
