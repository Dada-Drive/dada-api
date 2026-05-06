import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import request from 'supertest';

import { validate } from '@/middlewares/validate';

// Create a test app with a validated route
function createTestApp() {
  const app = express();
  app.use(express.json());

  app.post(
    '/test',
    validate([
      body('name').isString().notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Valid email is required'),
    ]),
    (_req: Request, res: Response) => {
      res.status(200).json({ success: true, data: { ok: true } });
    },
  );

  return app;
}

describe('validate middleware', () => {
  const app = createTestApp();

  it('passes valid input through to handler', async () => {
    const res = await request(app).post('/test').send({ name: 'Test', email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 with field-level errors for invalid input', async () => {
    const res = await request(app).post('/test').send({ name: '', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('returns field-specific error messages', async () => {
    const res = await request(app).post('/test').send({});

    expect(res.status).toBe(400);

    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toContain('name');
    expect(fields).toContain('email');
  });
});
