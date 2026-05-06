import fs from 'fs';
import path from 'path';

import request from 'supertest';

import { app } from '@/app';
import { generateTestToken } from '@/tests/helpers/auth';
import { createTestUser, resetFactoryCounters } from '@/tests/helpers/factories';
import {
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
  flushTestRedis,
} from '@/tests/setup';

// Create a tiny valid JPEG buffer (smallest valid JPEG: FF D8 FF E0 + minimal structure)
const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
  // Create fixtures dir and test image
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(FIXTURES_DIR, 'test.jpg'), VALID_JPEG);
  fs.writeFileSync(path.join(FIXTURES_DIR, 'test.txt'), 'not an image');
});

afterAll(async () => {
  await teardownTestDatabase();
  await teardownTestRedis();
  // Clean up fixtures
  if (fs.existsSync(FIXTURES_DIR)) {
    fs.rmSync(FIXTURES_DIR, { recursive: true });
  }
});

beforeEach(async () => {
  await truncateAllTables();
  await flushTestRedis();
  resetFactoryCounters();
});

describe('Upload Routes', () => {
  describe('POST /api/v1/upload/avatar', () => {
    it('uploads a valid image', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .post('/api/v1/upload/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', path.join(FIXTURES_DIR, 'test.jpg'));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBeDefined();
    });

    it('rejects non-image file', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id, user.role);

      const res = await request(app)
        .post('/api/v1/upload/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', path.join(FIXTURES_DIR, 'test.txt'));

      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/v1/upload/avatar')
        .attach('avatar', path.join(FIXTURES_DIR, 'test.jpg'));

      expect(res.status).toBe(401);
    });
  });
});
