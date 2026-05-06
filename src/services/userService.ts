import { User } from '@/models/index';
import { blacklistAllUserTokens, invalidateUserCache } from '@/services/jwtService';
import { UserRole } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';

// ── Types ───────────────────────────────────────────────────────────────────

interface UpdateProfileInput {
  fullName?: string;
  email?: string | null;
  avatarUrl?: string | null;
}

interface UserProfileResponse {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  avatarUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatProfile(user: User): UserProfileResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

// ── Get Profile ─────────────────────────────────────────────────────────────

async function getProfile(userId: string): Promise<UserProfileResponse> {
  const user = await User.findByPk(userId);
  if (!user) throw appError(ErrorCodes.USER.USER_NOT_FOUND);
  return formatProfile(user);
}

// ── Update Profile ──────────────────────────────────────────────────────────

async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfileResponse> {
  const user = await User.findByPk(userId);
  if (!user) throw appError(ErrorCodes.USER.USER_NOT_FOUND);

  if (input.fullName !== undefined) user.fullName = input.fullName;
  if (input.email !== undefined) user.email = input.email;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;

  await user.save();

  return formatProfile(user);
}

// ── Update Phone ────────────────────────────────────────────────────────────

async function updatePhone(userId: string, phone: string): Promise<UserProfileResponse> {
  const existing = await User.findOne({ where: { phone } });
  if (existing && existing.id !== userId) {
    throw appError(ErrorCodes.USER.PHONE_ALREADY_EXISTS);
  }

  const user = await User.findByPk(userId);
  if (!user) throw appError(ErrorCodes.USER.USER_NOT_FOUND);

  user.phone = phone;
  await user.save({ fields: ['phone'] });
  return formatProfile(user);
}

// ── Set Role ────────────────────────────────────────────────────────────────

async function setRole(userId: string, role: UserRole): Promise<UserProfileResponse> {
  const user = await User.findByPk(userId);
  if (!user) throw appError(ErrorCodes.USER.USER_NOT_FOUND);

  user.role = role;
  await user.save({ fields: ['role'] });
  await invalidateUserCache(userId);
  return formatProfile(user);
}

// ── Deactivate Account ──────────────────────────────────────────────────────

async function deactivateAccount(userId: string): Promise<void> {
  const user = await User.findByPk(userId);
  if (!user) throw appError(ErrorCodes.USER.USER_NOT_FOUND);

  user.isActive = false;
  await user.save({ fields: ['isActive'] });
  await blacklistAllUserTokens(userId);
  await invalidateUserCache(userId);
}

export { deactivateAccount, getProfile, setRole, updatePhone, updateProfile };
export type { UpdateProfileInput, UserProfileResponse };
