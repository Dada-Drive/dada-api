import { DriverProfile, Ride, User, Vehicle, WalletTransaction } from '@/models/index';
import { blacklistAllUserTokens, invalidateUserCache } from '@/services/jwtService';
import { RideStatus, UserRole } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';
import { parseFilters, parseSorting } from '@/utils/filtering';
import { buildPaginationMeta, parsePaginationQuery } from '@/utils/pagination';

import type { PaginationMeta } from '@/types/pagination';

// ── Stats ───────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalUsers: number;
  totalDrivers: number;
  totalRides: number;
  completedRides: number;
  totalTransactions: number;
}

async function getStats(): Promise<PlatformStats> {
  const [totalUsers, totalDrivers, totalRides, completedRides, totalTransactions] =
    await Promise.all([
      User.count(),
      DriverProfile.count(),
      Ride.count(),
      Ride.count({ where: { status: RideStatus.Completed } }),
      WalletTransaction.count(),
    ]);

  return { totalUsers, totalDrivers, totalRides, completedRides, totalTransactions };
}

// ── List Users ──────────────────────────────────────────────────────────────

async function listUsers(
  query: Record<string, unknown>,
): Promise<{ rows: User[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);
  const where = parseFilters(query, ['role', 'isActive']);
  const order = parseSorting(query.sort, ['createdAt', 'fullName', 'role']);

  const { rows, count } = await User.findAndCountAll({ where, order, offset, limit });
  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── Get User Details ────────────────────────────────────────────────────────

async function getUserDetails(userId: string): Promise<User> {
  const user = await User.findByPk(userId, {
    include: [
      { model: DriverProfile, as: 'driverProfile', include: [{ model: Vehicle, as: 'vehicle' }] },
    ],
  });
  if (!user) throw appError(ErrorCodes.USER.USER_NOT_FOUND);
  return user;
}

// ── Deactivate User ─────────────────────────────────────────────────────────

async function deactivateUser(userId: string): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) throw appError(ErrorCodes.USER.USER_NOT_FOUND);

  user.isActive = false;
  await user.save();
  await blacklistAllUserTokens(userId);
  await invalidateUserCache(userId);
  return user;
}

// ── Activate User ───────────────────────────────────────────────────────────

async function activateUser(userId: string): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) throw appError(ErrorCodes.USER.USER_NOT_FOUND);

  user.isActive = true;
  await user.save();
  await invalidateUserCache(userId);
  return user;
}

// ── List Drivers ────────────────────────────────────────────────────────────

async function listDrivers(
  query: Record<string, unknown>,
): Promise<{ rows: DriverProfile[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);
  const where = parseFilters(query, ['isApproved', 'isOnline']);
  const order = parseSorting(query.sort, ['createdAt', 'rating', 'totalRides']);

  const { rows, count } = await DriverProfile.findAndCountAll({
    where,
    order,
    offset,
    limit,
    include: [
      { model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'avatarUrl'] },
      { model: Vehicle, as: 'vehicle' },
    ],
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── Get Pending Drivers ─────────────────────────────────────────────────────

async function getPendingDrivers(
  query: Record<string, unknown>,
): Promise<{ rows: DriverProfile[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);

  const { rows, count } = await DriverProfile.findAndCountAll({
    where: { isApproved: false },
    order: [['createdAt', 'ASC']],
    offset,
    limit,
    include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'avatarUrl'] }],
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── Approve / Reject Driver ─────────────────────────────────────────────────

async function approveDriver(userId: string): Promise<DriverProfile> {
  const profile = await DriverProfile.findOne({ where: { userId } });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  profile.isApproved = true;
  await profile.save();

  // Set user role to driver
  await User.update({ role: UserRole.Driver }, { where: { id: userId } });
  await invalidateUserCache(userId);

  return profile;
}

async function rejectDriver(userId: string): Promise<DriverProfile> {
  const profile = await DriverProfile.findOne({ where: { userId } });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  profile.isApproved = false;
  await profile.save();
  return profile;
}

// ── List Rides ──────────────────────────────────────────────────────────────

async function listRides(
  query: Record<string, unknown>,
): Promise<{ rows: Ride[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);
  const where = parseFilters(query, ['status', 'vehicleType']);
  const order = parseSorting(query.sort, ['createdAt', 'status', 'calculatedFare']);

  const { rows, count } = await Ride.findAndCountAll({
    where,
    order,
    offset,
    limit,
    include: [
      { model: User, as: 'rider', attributes: ['id', 'fullName'] },
      { model: User, as: 'driver', attributes: ['id', 'fullName'] },
    ],
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── List Transactions ───────────────────────────────────────────────────────

async function listTransactions(
  query: Record<string, unknown>,
): Promise<{ rows: WalletTransaction[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);
  const where = parseFilters(query, ['type', 'status']);
  const order = parseSorting(query.sort, ['createdAt', 'amount', 'type']);

  const { rows, count } = await WalletTransaction.findAndCountAll({
    where,
    order,
    offset,
    limit,
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

export {
  activateUser,
  approveDriver,
  deactivateUser,
  getPendingDrivers,
  getStats,
  getUserDetails,
  listDrivers,
  listRides,
  listTransactions,
  listUsers,
  rejectDriver,
};
