import bcrypt from 'bcrypt';

import { captureNonFatal } from '@/config/sentry';
import { RefreshToken, sequelize, User, Wallet } from '@/models/index';
import { verifyGoogleToken } from '@/services/googleAuthService';
import {
  blacklistAllUserTokens,
  blacklistToken,
  generateTokenPair,
  invalidateUserCache,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/services/jwtService';
import { verifyOtp } from '@/services/otpService';
import { UserRole } from '@/types/enums';
import { appError, ErrorCodes } from '@/types/errorCodes';

import type { TokenPair } from '@/services/jwtService';

// ── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

// ── Types ────────────────────────────────────────────────────────────────────

interface RegisterInput {
  fullName: string;
  phone: string;
  password: string;
}

interface AuthResult {
  user: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    role: UserRole;
    isVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUserResponse(user: User): AuthResult['user'] {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
  };
}

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId, token, expiresAt });
}

// ── Register ─────────────────────────────────────────────────────────────────

async function register(input: RegisterInput): Promise<AuthResult> {
  const { fullName, phone, password } = input;

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Atomic: create user + wallet in a single transaction
  const user = await sequelize.transaction(async (t) => {
    const newUser = await User.create(
      { fullName, phone, passwordHash, role: UserRole.Rider },
      { transaction: t },
    );

    await Wallet.create({ ownerId: newUser.id }, { transaction: t });

    return newUser;
  });

  const tokens = generateTokenPair(user.id, user.role);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return {
    user: formatUserResponse(user),
    ...tokens,
  };
}

// ── Login ────────────────────────────────────────────────────────────────────

async function login(phone: string, password: string): Promise<AuthResult> {
  // Use withPassword scope to include passwordHash
  const user = await User.scope('withPassword').findOne({ where: { phone } });

  if (!user || !user.passwordHash) {
    throw appError(ErrorCodes.AUTH.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw appError(ErrorCodes.AUTH.ACCOUNT_SUSPENDED);
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw appError(ErrorCodes.AUTH.INVALID_CREDENTIALS);
  }

  const tokens = generateTokenPair(user.id, user.role);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return {
    user: formatUserResponse(user),
    ...tokens,
  };
}

// ── Refresh Token ────────────────────────────────────────────────────────────

async function refreshToken(token: string): Promise<TokenPair> {
  // Verify the JWT signature and expiry
  const payload = verifyRefreshToken(token);

  // Look up the stored refresh token
  const storedToken = await RefreshToken.findOne({
    where: { token, userId: payload.userId },
  });

  if (!storedToken) {
    captureNonFatal(new Error('Token refresh failed — stored token not found'), {
      userId: payload.userId,
      type: 'token_refresh_failure',
    });
    throw appError(ErrorCodes.AUTH.TOKEN_INVALID);
  }

  // Delete old token (rotation — single use)
  await storedToken.destroy();

  // Fetch current user role for the new access token
  const user = await User.findByPk(payload.userId, {
    attributes: ['id', 'role', 'isActive'],
  });

  if (!user || !user.isActive) {
    throw appError(ErrorCodes.AUTH.ACCOUNT_SUSPENDED);
  }

  // Generate new token pair
  const newTokens = generateTokenPair(user.id, user.role);
  await storeRefreshToken(user.id, newTokens.refreshToken);

  return newTokens;
}

// ── Logout ───────────────────────────────────────────────────────────────────

async function logout(accessToken: string, refreshTokenStr?: string): Promise<void> {
  // Blacklist the access token
  const payload = verifyAccessToken(accessToken);
  await blacklistToken(payload.jti, payload.exp);

  // Delete the refresh token from DB if provided
  if (refreshTokenStr) {
    await RefreshToken.destroy({
      where: { token: refreshTokenStr, userId: payload.userId },
    });
  }
}

// ── Logout All Devices ───────────────────────────────────────────────────────

async function logoutAll(userId: string, currentAccessToken: string): Promise<void> {
  const payload = verifyAccessToken(currentAccessToken);

  // Blacklist all access tokens for this user
  await blacklistAllUserTokens(userId);
  await blacklistToken(payload.jti, payload.exp);

  // Delete all refresh tokens
  await RefreshToken.destroy({ where: { userId } });

  // Invalidate user cache
  await invalidateUserCache(userId);
}

// ── Change Password ──────────────────────────────────────────────────────────

async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.scope('withPassword').findByPk(userId);

  if (!user || !user.passwordHash) {
    throw appError(ErrorCodes.AUTH.ACCOUNT_NOT_FOUND);
  }

  const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isMatch) {
    throw appError(ErrorCodes.AUTH.INVALID_CREDENTIALS);
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.update({ passwordHash: newHash });

  // Invalidate all sessions
  await blacklistAllUserTokens(userId);
  await RefreshToken.destroy({ where: { userId } });
  await invalidateUserCache(userId);
}

// ── Reset Password with OTP ──────────────────────────────────────────────────

async function resetPasswordWithOtp(
  phone: string,
  code: string,
  newPassword: string,
): Promise<void> {
  // Verify OTP first (throws if invalid)
  await verifyOtp(phone, code);

  const user = await User.scope('withPassword').findOne({ where: { phone } });
  if (!user) {
    throw appError(ErrorCodes.AUTH.ACCOUNT_NOT_FOUND);
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.update({ passwordHash: newHash });

  // Invalidate all sessions
  await blacklistAllUserTokens(user.id);
  await RefreshToken.destroy({ where: { userId: user.id } });
  await invalidateUserCache(user.id);
}

// ── Google Auth ──────────────────────────────────────────────────────────────

async function googleAuth(idToken: string, phone?: string): Promise<AuthResult> {
  const googleUser = await verifyGoogleToken(idToken);

  // 1. Try finding by Google ID
  let user = await User.findOne({ where: { googleId: googleUser.googleId } });

  if (user) {
    if (!user.isActive) {
      throw appError(ErrorCodes.AUTH.ACCOUNT_SUSPENDED);
    }
    const tokens = generateTokenPair(user.id, user.role);
    await storeRefreshToken(user.id, tokens.refreshToken);
    return { user: formatUserResponse(user), ...tokens };
  }

  // 2. Try finding by email — link Google account
  if (googleUser.email) {
    user = await User.findOne({ where: { email: googleUser.email } });
    if (user) {
      if (!user.isActive) {
        throw appError(ErrorCodes.AUTH.ACCOUNT_SUSPENDED);
      }
      await user.update({
        googleId: googleUser.googleId,
        avatarUrl: user.avatarUrl ?? googleUser.avatarUrl,
      });
      const tokens = generateTokenPair(user.id, user.role);
      await storeRefreshToken(user.id, tokens.refreshToken);
      return { user: formatUserResponse(user), ...tokens };
    }
  }

  // 3. New user — phone is required
  if (!phone) {
    throw appError(ErrorCodes.GENERAL.VALIDATION_ERROR, {
      reason: 'Phone number is required for new Google sign-up',
    });
  }

  // Create user + wallet atomically
  const newUser = await sequelize.transaction(async (t) => {
    const created = await User.create(
      {
        fullName: googleUser.fullName,
        phone,
        email: googleUser.email,
        googleId: googleUser.googleId,
        avatarUrl: googleUser.avatarUrl,
        isVerified: true,
        role: UserRole.Rider,
      },
      { transaction: t },
    );

    await Wallet.create({ ownerId: created.id }, { transaction: t });

    return created;
  });

  const tokens = generateTokenPair(newUser.id, newUser.role);
  await storeRefreshToken(newUser.id, tokens.refreshToken);

  return { user: formatUserResponse(newUser), ...tokens };
}

// ── Get Me ───────────────────────────────────────────────────────────────────

async function getMe(userId: string): Promise<AuthResult['user']> {
  const user = await User.findByPk(userId);

  if (!user) {
    throw appError(ErrorCodes.AUTH.ACCOUNT_NOT_FOUND);
  }

  return formatUserResponse(user);
}

export {
  changePassword,
  getMe,
  googleAuth,
  login,
  logout,
  logoutAll,
  refreshToken,
  register,
  resetPasswordWithOtp,
};
export type { AuthResult, RegisterInput };
