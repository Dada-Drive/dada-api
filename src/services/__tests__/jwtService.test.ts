import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  blacklistToken,
  blacklistAllUserTokens,
  isBlacklisted,
  cacheUser,
  getCachedUser,
  invalidateUserCache,
} from '@/services/jwtService';
import { setupTestRedis, teardownTestRedis, flushTestRedis } from '@/tests/setup';
import { UserRole } from '@/types/enums';

beforeAll(async () => {
  await setupTestRedis();
});

afterAll(async () => {
  await teardownTestRedis();
});

beforeEach(async () => {
  await flushTestRedis();
});

describe('jwtService', () => {
  describe('generateAccessToken', () => {
    it('returns a valid JWT with jti', () => {
      const { accessToken, jti } = generateAccessToken('user-1', UserRole.Rider);

      expect(accessToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(jti).toBeDefined();
      expect(typeof jti).toBe('string');
    });

    it('generates unique jti per call', () => {
      const first = generateAccessToken('user-1', UserRole.Rider);
      const second = generateAccessToken('user-1', UserRole.Rider);

      expect(first.jti).not.toBe(second.jti);
    });
  });

  describe('verifyAccessToken', () => {
    it('returns decoded payload for valid token', () => {
      const { accessToken } = generateAccessToken('user-1', UserRole.Driver);
      const payload = verifyAccessToken(accessToken);

      expect(payload.userId).toBe('user-1');
      expect(payload.role).toBe(UserRole.Driver);
      expect(payload.jti).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it('throws TOKEN_INVALID for tampered token', () => {
      const { accessToken } = generateAccessToken('user-1', UserRole.Rider);

      expect(() => verifyAccessToken(accessToken + 'tampered')).toThrow(
        expect.objectContaining({ code: 'TOKEN_INVALID' }),
      );
    });

    it('throws TOKEN_INVALID for garbage string', () => {
      expect(() => verifyAccessToken('not-a-jwt')).toThrow(
        expect.objectContaining({ code: 'TOKEN_INVALID' }),
      );
    });
  });

  describe('generateRefreshToken / verifyRefreshToken', () => {
    it('generates and verifies a refresh token', () => {
      const token = generateRefreshToken('user-2');
      const payload = verifyRefreshToken(token);

      expect(payload.userId).toBe('user-2');
      expect(payload.jti).toBeDefined();
    });

    it('throws for invalid refresh token', () => {
      expect(() => verifyRefreshToken('invalid')).toThrow(
        expect.objectContaining({ code: 'TOKEN_INVALID' }),
      );
    });
  });

  describe('blacklist', () => {
    it('blacklists a single token by jti', async () => {
      const { jti } = generateAccessToken('user-1', UserRole.Rider);
      const futureExp = Math.floor(Date.now() / 1000) + 900;

      await blacklistToken(jti, futureExp);

      const result = await isBlacklisted(jti, 'user-1');
      expect(result).toBe(true);
    });

    it('non-blacklisted token returns false', async () => {
      const result = await isBlacklisted('non-existent-jti', 'user-1');
      expect(result).toBe(false);
    });

    it('blacklists all tokens for a user', async () => {
      await blacklistAllUserTokens('user-3');

      const result = await isBlacklisted('any-jti', 'user-3');
      expect(result).toBe(true);
    });

    it('does not blacklist if token already expired', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 10;
      await blacklistToken('expired-jti', pastExp);

      const result = await isBlacklisted('expired-jti', 'no-user');
      expect(result).toBe(false);
    });
  });

  describe('user cache', () => {
    it('caches and retrieves user data', async () => {
      const data = JSON.stringify({ isActive: true, role: UserRole.Rider });
      await cacheUser('user-1', data);

      const cached = await getCachedUser('user-1');
      expect(cached).toBe(data);
    });

    it('returns null for non-cached user', async () => {
      const cached = await getCachedUser('non-existent');
      expect(cached).toBeNull();
    });

    it('invalidates user cache', async () => {
      const data = JSON.stringify({ isActive: true, role: UserRole.Admin });
      await cacheUser('user-2', data);
      await invalidateUserCache('user-2');

      const cached = await getCachedUser('user-2');
      expect(cached).toBeNull();
    });
  });
});
