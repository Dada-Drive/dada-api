import { RefreshToken, Wallet } from '@/models/index';
import * as authService from '@/services/authService';
import { isBlacklisted } from '@/services/jwtService';
import {
  createTestUser,
  createTestRefreshToken,
  DEFAULT_PASSWORD,
  resetFactoryCounters,
} from '@/tests/helpers/factories';
import {
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
  flushTestRedis,
} from '@/tests/setup';

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

describe('authService', () => {
  describe('register', () => {
    it('creates user and wallet atomically', async () => {
      const result = await authService.register({
        fullName: 'New User',
        phone: '+21650000001',
        password: 'ValidPass1',
      });

      expect(result.user.fullName).toBe('New User');
      expect(result.user.phone).toBe('+21650000001');
      expect(result.user.role).toBe('rider');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Verify wallet was created
      const wallet = await Wallet.findOne({ where: { ownerId: result.user.id } });
      expect(wallet).not.toBeNull();
      expect(Number(wallet!.balance)).toBe(10);
    });

    it('rejects registration with duplicate phone', async () => {
      await createTestUser({ phone: '+21650000002' });

      await expect(
        authService.register({
          fullName: 'Duplicate',
          phone: '+21650000002',
          password: 'ValidPass1',
        }),
      ).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('returns tokens for correct credentials', async () => {
      const user = await createTestUser({ phone: '+21650000003' });

      const result = await authService.login('+21650000003', DEFAULT_PASSWORD);

      expect(result.user.id).toBe(user.id);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('rejects wrong password', async () => {
      await createTestUser({ phone: '+21650000004' });

      await expect(authService.login('+21650000004', 'WrongPass1')).rejects.toThrow(
        expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      );
    });

    it('rejects suspended account', async () => {
      await createTestUser({ phone: '+21650000005', isActive: false });

      await expect(authService.login('+21650000005', DEFAULT_PASSWORD)).rejects.toThrow(
        expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }),
      );
    });

    it('rejects non-existent phone', async () => {
      await expect(authService.login('+21699999999', 'AnyPass1')).rejects.toThrow(
        expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      );
    });
  });

  describe('refreshToken', () => {
    it('returns new token pair and invalidates old refresh token', async () => {
      const user = await createTestUser();
      const { token: oldToken } = await createTestRefreshToken(user.id);

      const newTokens = await authService.refreshToken(oldToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();

      // Old token should be deleted
      const oldRecord = await RefreshToken.findOne({ where: { token: oldToken } });
      expect(oldRecord).toBeNull();
    });

    it('rejects an already-used refresh token', async () => {
      const user = await createTestUser();
      const { token } = await createTestRefreshToken(user.id);

      // First use — succeeds
      await authService.refreshToken(token);

      // Second use — should fail (token was deleted)
      await expect(authService.refreshToken(token)).rejects.toThrow(
        expect.objectContaining({ code: 'TOKEN_INVALID' }),
      );
    });
  });

  describe('logout', () => {
    it('blacklists the access token', async () => {
      const user = await createTestUser();
      const loginResult = await authService.login(user.phone, DEFAULT_PASSWORD);

      await authService.logout(loginResult.accessToken, loginResult.refreshToken);

      // The access token's jti should be blacklisted
      // We verify by parsing the token
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.decode(loginResult.accessToken) as { jti: string; sub: string };
      const blacklisted = await isBlacklisted(decoded.jti, user.id);
      expect(blacklisted).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('changes password and invalidates all sessions', async () => {
      const user = await createTestUser({ phone: '+21650000010' });
      await createTestRefreshToken(user.id);

      await authService.changePassword(user.id, DEFAULT_PASSWORD, 'NewPass123');

      // Old password should no longer work
      await expect(authService.login('+21650000010', DEFAULT_PASSWORD)).rejects.toThrow(
        expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      );

      // New password should work
      const result = await authService.login('+21650000010', 'NewPass123');
      expect(result.accessToken).toBeDefined();

      // All old refresh tokens should be deleted
      const tokens = await RefreshToken.findAll({ where: { userId: user.id } });
      // Only the token from the new login should exist
      expect(tokens.length).toBe(1);
    });

    it('rejects incorrect old password', async () => {
      const user = await createTestUser();

      await expect(authService.changePassword(user.id, 'WrongOld1', 'NewPass123')).rejects.toThrow(
        expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      );
    });
  });

  describe('getMe', () => {
    it('returns user profile', async () => {
      const user = await createTestUser({
        fullName: 'Test Profile',
        phone: '+21650000020',
      });

      const result = await authService.getMe(user.id);

      expect(result.id).toBe(user.id);
      expect(result.fullName).toBe('Test Profile');
      expect(result.phone).toBe('+21650000020');
    });

    it('throws for non-existent user', async () => {
      await expect(authService.getMe('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        expect.objectContaining({ code: 'ACCOUNT_NOT_FOUND' }),
      );
    });
  });
});
