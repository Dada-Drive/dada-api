import bcrypt from 'bcrypt';

import {
  DeviceToken,
  DriverProfile,
  DriverServiceType,
  Notification,
  OtpCode,
  Rating,
  RefreshToken,
  Ride,
  RideOffer,
  User,
  Vehicle,
  Wallet,
  WalletTransaction,
} from '@/models/index';
import { generateRefreshToken } from '@/services/jwtService';
import {
  DevicePlatform,
  NotificationType,
  OfferStatus,
  RideStatus,
  ServiceType,
  TransactionStatus,
  TransactionType,
  UserRole,
  VehicleType,
} from '@/types/enums';

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

// ── Driver Profile Factory ──────────────────────────────────────────────────

let driverCounter = 0;

async function createTestDriverProfile(
  userId: string,
  overrides: Partial<{
    licenseNumber: string;
    licenseExpiry: string;
    cin: string;
    cinDeliveredAt: string;
    isApproved: boolean;
    isOnline: boolean;
    lastLat: number;
    lastLng: number;
  }> = {},
): Promise<DriverProfile> {
  driverCounter++;
  return DriverProfile.create({
    userId,
    licenseNumber: overrides.licenseNumber ?? `LIC${String(driverCounter).padStart(6, '0')}`,
    licenseExpiry: overrides.licenseExpiry ?? '2030-12-31',
    cin: overrides.cin ?? `CIN${String(driverCounter).padStart(6, '0')}`,
    cinDeliveredAt: overrides.cinDeliveredAt ?? '2020-01-01',
    isApproved: overrides.isApproved ?? false,
    isOnline: overrides.isOnline ?? false,
    lastLat: overrides.lastLat ?? null,
    lastLng: overrides.lastLng ?? null,
  });
}

// ── Vehicle Factory ─────────────────────────────────────────────────────────

let vehicleCounter = 0;

async function createTestVehicle(
  driverId: string,
  overrides: Partial<{
    make: string;
    model: string;
    plateNumber: string;
    color: string;
    vehicleType: VehicleType;
  }> = {},
): Promise<Vehicle> {
  vehicleCounter++;
  return Vehicle.create({
    driverId,
    make: overrides.make ?? 'Toyota',
    model: overrides.model ?? 'Corolla',
    plateNumber: overrides.plateNumber ?? `TN-${String(vehicleCounter).padStart(4, '0')}`,
    color: overrides.color ?? 'White',
    vehicleType: overrides.vehicleType ?? VehicleType.Economy,
  });
}

// ── Driver Service Type Factory ─────────────────────────────────────────────

async function createTestDriverServiceType(
  driverId: string,
  serviceType: ServiceType = ServiceType.Taxi,
): Promise<DriverServiceType> {
  return DriverServiceType.create({ driverId, serviceType });
}

// ── Ride Factory ────────────────────────────────────────────────────────────

async function createTestRide(
  riderId: string,
  overrides: Partial<{
    driverId: string | null;
    vehicleType: VehicleType;
    status: RideStatus;
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    dropoffAddress: string;
    distanceKm: number;
    estimatedMinutes: number;
    calculatedFare: number;
    isShared: boolean;
    sharedSeatsAvailable: number;
  }> = {},
): Promise<Ride> {
  return Ride.create({
    riderId,
    driverId: overrides.driverId ?? null,
    vehicleType: overrides.vehicleType ?? VehicleType.Economy,
    status: overrides.status ?? RideStatus.Pending,
    pickupLat: overrides.pickupLat ?? 36.8065,
    pickupLng: overrides.pickupLng ?? 10.1815,
    pickupAddress: overrides.pickupAddress ?? 'Tunis Centre',
    dropoffLat: overrides.dropoffLat ?? 36.8265,
    dropoffLng: overrides.dropoffLng ?? 10.2015,
    dropoffAddress: overrides.dropoffAddress ?? 'La Marsa',
    distanceKm: overrides.distanceKm ?? 5.0,
    estimatedMinutes: overrides.estimatedMinutes ?? 15,
    calculatedFare: overrides.calculatedFare ?? 12.5,
    isShared: overrides.isShared ?? false,
    sharedSeatsAvailable: overrides.sharedSeatsAvailable ?? null,
  });
}

// ── Ride Offer Factory ──────────────────────────────────────────────────────

async function createTestRideOffer(
  rideId: string,
  driverId: string,
  overrides: Partial<{ offeredFare: number; status: OfferStatus }> = {},
): Promise<RideOffer> {
  return RideOffer.create({
    rideId,
    driverId,
    offeredFare: overrides.offeredFare ?? 15.0,
    status: overrides.status ?? OfferStatus.Pending,
  });
}

// ── Rating Factory ──────────────────────────────────────────────────────────

async function createTestRating(
  rideId: string,
  riderId: string,
  driverId: string,
  overrides: Partial<{ score: number; comment: string }> = {},
): Promise<Rating> {
  return Rating.create({
    rideId,
    riderId,
    driverId,
    score: overrides.score ?? 5,
    comment: overrides.comment ?? null,
  });
}

// ── Wallet Transaction Factory ──────────────────────────────────────────────

async function createTestWalletTransaction(
  walletOwnerId: string,
  overrides: Partial<{
    type: TransactionType;
    amount: number;
    status: TransactionStatus;
    description: string;
  }> = {},
): Promise<WalletTransaction> {
  return WalletTransaction.create({
    walletOwnerId,
    type: overrides.type ?? TransactionType.TopupManual,
    amount: overrides.amount ?? 100,
    status: overrides.status ?? TransactionStatus.Completed,
    description: overrides.description ?? null,
  });
}

// ── Device Token Factory ────────────────────────────────────────────────────

let notificationCounter = 0;

async function createTestNotification(
  userId: string,
  overrides: Partial<{
    type: NotificationType;
    title: string;
    body: string;
    data: Record<string, string> | null;
    isRead: boolean;
  }> = {},
): Promise<Notification> {
  notificationCounter++;
  return Notification.create({
    userId,
    type: overrides.type ?? NotificationType.RideOffer,
    title: overrides.title ?? `Test Notification ${String(notificationCounter)}`,
    body: overrides.body ?? `Test notification body ${String(notificationCounter)}`,
    data: overrides.data ?? null,
    isRead: overrides.isRead ?? false,
  });
}

// ── Device Token Factory ────────────────────────────────────────────────────

let deviceCounter = 0;

async function createTestDeviceToken(
  userId: string,
  overrides: Partial<{ token: string; platform: DevicePlatform }> = {},
): Promise<DeviceToken> {
  deviceCounter++;
  return DeviceToken.create({
    userId,
    token: overrides.token ?? `device-token-${String(deviceCounter)}`,
    platform: overrides.platform ?? DevicePlatform.Android,
  });
}

// ── Reset counter between test suites ────────────────────────────────────────

function resetFactoryCounters(): void {
  userCounter = 0;
  driverCounter = 0;
  vehicleCounter = 0;
  notificationCounter = 0;
  deviceCounter = 0;
  defaultPasswordHash = null;
}

export {
  createTestDeviceToken,
  createTestDriverProfile,
  createTestDriverServiceType,
  createTestNotification,
  createTestOtp,
  createTestRating,
  createTestRefreshToken,
  createTestRide,
  createTestRideOffer,
  createTestUser,
  createTestVehicle,
  createTestWallet,
  createTestWalletTransaction,
  DEFAULT_PASSWORD,
  resetFactoryCounters,
};
