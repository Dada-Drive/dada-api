import bcrypt from 'bcrypt';

import { OtpCode, RefreshToken, User, Wallet } from '@/models/index';
import { generateRefreshToken } from '@/services/jwtService';
import { UserRole } from '@/types/enums';

// ── Default password ─────────────────────────────────────────────────────────

const DEFAULT_PASSWORD = 'TestPass1';
let defaultPasswordHash: string | null = null;

async function getDefaultPasswordHash(): Promise<string> {
  if (!defaultPasswordHash) {
    defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  }
  return defaultPasswordHash;
}

// ── User Factory ─────────────────────────────────────────────────────────────

interface CreateTestUserOptions {
  fullName?: string;
  phone?: string;
  email?: string | null;
  passwordHash?: string | null;
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  googleId?: string | null;
}

let userCounter = 0;

async function createTestUser(overrides: CreateTestUserOptions = {}): Promise<User> {
  userCounter++;
  const hash = await getDefaultPasswordHash();

  return User.create({
    fullName: overrides.fullName ?? `Test User ${String(userCounter)}`,
    phone: overrides.phone ?? `+2161000${String(userCounter).padStart(4, '0')}`,
    email: overrides.email ?? null,
    passwordHash: overrides.passwordHash === undefined ? hash : overrides.passwordHash,
    role: overrides.role ?? UserRole.Rider,
    isActive: overrides.isActive ?? true,
    isVerified: overrides.isVerified ?? false,
    googleId: overrides.googleId ?? null,
  });
}

// ── Wallet Factory ───────────────────────────────────────────────────────────

async function createTestWallet(userId: string, balance = 0): Promise<Wallet> {
  return Wallet.create({ ownerId: userId, balance });
}

// ── OTP Factory ──────────────────────────────────────────────────────────────

async function createTestOtp(
  phone: string,
  code = '123456',
  options: { isUsed?: boolean; attempts?: number; expiresInMinutes?: number } = {},
): Promise<OtpCode> {
  const codeHash = await bcrypt.hash(code, 12);
  const expiresAt = new Date(Date.now() + (options.expiresInMinutes ?? 5) * 60 * 1000);

  return OtpCode.create({
    phone,
    codeHash,
    isUsed: options.isUsed ?? false,
    attempts: options.attempts ?? 0,
    expiresAt,
  });
}

// ── Refresh Token Factory ────────────────────────────────────────────────────

async function createTestRefreshToken(
  userId: string,
): Promise<{ record: RefreshToken; token: string }> {
  const token = generateRefreshToken(userId);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const record = await RefreshToken.create({ userId, token, expiresAt });
  return { record, token };
}

// ── Reset counter between test suites ────────────────────────────────────────

function resetFactoryCounters(): void {
  userCounter = 0;
  defaultPasswordHash = null;
}

export {
  createTestOtp,
  createTestRefreshToken,
  createTestUser,
  createTestWallet,
  DEFAULT_PASSWORD,
  resetFactoryCounters,
};
