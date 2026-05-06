import { Request, Response, NextFunction } from 'express';

import { protect, restrictTo } from '@/middlewares/auth';
import { blacklistToken, blacklistAllUserTokens, generateAccessToken } from '@/services/jwtService';
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
import { UserRole } from '@/types/enums';

beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
});

afterAll(async () => {
  await teardownTestDatabase();
  await teardownTestRedis();
});

beforeEach(async () => {
  await truncateAllTables();
  await flushTestRedis();
  resetFactoryCounters();
});

// Helper to create mock req/res/next
function createMockReqResNext(overrides: Partial<Request> = {}): {
  req: Request;
  res: Response;
  next: NextFunction;
  nextError: jest.Mock;
} {
  const req = {
    headers: {},
    ...overrides,
  } as Request;
  const res = {} as Response;
  const nextError = jest.fn();
  const next: NextFunction = nextError;
  return { req, res, next, nextError };
}

describe('protect middleware', () => {
  it('attaches req.user for valid token', async () => {
    const user = await createTestUser({ phone: '+21650100001' });
    const token = generateTestToken(user.id, UserRole.Rider);
    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${token}` } as Record<string, string>,
    });

    await protect(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe(user.id);
    expect(req.user!.role).toBe(UserRole.Rider);
    expect(next).toHaveBeenCalled();
  });

  it('rejects request without Authorization header', async () => {
    const { req, res, next } = createMockReqResNext();

    await expect(protect(req, res, next)).rejects.toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('rejects expired token', async () => {
    // Generate a token with already-expired time
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.sign(
      { userId: 'test', role: 'rider', jti: 'test-jti' },
      process.env.JWT_SECRET!,
      { expiresIn: '0s' },
    );

    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${expiredToken}` } as Record<string, string>,
    });

    await expect(protect(req, res, next)).rejects.toThrow(
      expect.objectContaining({ code: 'TOKEN_EXPIRED' }),
    );
  });

  it('rejects blacklisted token (by jti)', async () => {
    const user = await createTestUser({ phone: '+21650100002' });
    const { accessToken, jti } = generateAccessToken(user.id, UserRole.Rider);

    // Blacklist the token
    const futureExp = Math.floor(Date.now() / 1000) + 900;
    await blacklistToken(jti, futureExp);

    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${accessToken}` } as Record<string, string>,
    });

    await expect(protect(req, res, next)).rejects.toThrow(
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
  });

  it('rejects blacklisted user (all tokens)', async () => {
    const user = await createTestUser({ phone: '+21650100003' });
    const token = generateTestToken(user.id, UserRole.Rider);

    await blacklistAllUserTokens(user.id);

    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${token}` } as Record<string, string>,
    });

    await expect(protect(req, res, next)).rejects.toThrow(
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
  });

  it('rejects inactive user', async () => {
    const user = await createTestUser({ phone: '+21650100004', isActive: false });
    const token = generateTestToken(user.id, UserRole.Rider);

    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${token}` } as Record<string, string>,
    });

    await expect(protect(req, res, next)).rejects.toThrow(
      expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }),
    );
  });

  it('rejects token for non-existent user', async () => {
    const token = generateTestToken('00000000-0000-0000-0000-000000000000', UserRole.Rider);

    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${token}` } as Record<string, string>,
    });

    await expect(protect(req, res, next)).rejects.toThrow(
      expect.objectContaining({ code: 'ACCOUNT_NOT_FOUND' }),
    );
  });
});

describe('restrictTo middleware', () => {
  it('allows access for matching role', () => {
    const middleware = restrictTo(UserRole.Admin);
    const { req, res, next, nextError } = createMockReqResNext();
    req.user = { userId: 'user-1', role: UserRole.Admin };

    middleware(req, res, next);

    expect(nextError).toHaveBeenCalledWith();
  });

  it('rejects access for non-matching role', () => {
    const middleware = restrictTo(UserRole.Admin);
    const { req, res, next } = createMockReqResNext();
    req.user = { userId: 'user-1', role: UserRole.Rider };

    expect(() => middleware(req, res, next)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('allows access when multiple roles accepted', () => {
    const middleware = restrictTo(UserRole.Admin, UserRole.Driver);
    const { req, res, next, nextError } = createMockReqResNext();
    req.user = { userId: 'user-1', role: UserRole.Driver };

    middleware(req, res, next);

    expect(nextError).toHaveBeenCalledWith();
  });
});
