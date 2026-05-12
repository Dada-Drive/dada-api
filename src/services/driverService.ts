import { Op } from 'sequelize';

import { redisClient } from '@/config/redis';
import { DriverProfile, User, Vehicle } from '@/models/index';
import { cacheDel, cacheGet, cacheSet } from '@/services/cacheService';
import * as redisGeo from '@/services/redisGeoService';
import { VehicleType } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';
import { logger } from '@/utils/logger';

import type { NearbyDriver } from '@/services/redisGeoService';

// ── Types ───────────────────────────────────────────────────────────────────

interface CreateProfileInput {
  licenseNumber: string;
  licenseExpiry: string;
  cin: string;
  cinDeliveredAt: string;
  cinPhotoFront?: string;
  cinPhotoBack?: string;
  licensePhotoFront?: string;
  licensePhotoBack?: string;
}

interface UpdateProfileInput {
  licenseNumber?: string;
  licenseExpiry?: string;
  cinPhotoFront?: string;
  cinPhotoBack?: string;
  licensePhotoFront?: string;
  licensePhotoBack?: string;
}

interface RegisterVehicleInput {
  make: string;
  model: string;
  year?: number;
  plateNumber: string;
  color: string;
  vehicleType?: VehicleType;
  doors?: number;
  seats?: number;
  photoFront?: string;
  photoSide?: string;
  photoBack?: string;
}

interface UpdateVehicleInput {
  color?: string;
  vehicleType?: VehicleType;
  doors?: number;
  seats?: number;
  photoFront?: string;
  photoSide?: string;
  photoBack?: string;
}

interface NearbyQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
  vehicleType?: VehicleType;
}

// ── Create Profile ──────────────────────────────────────────────────────────

async function createProfile(userId: string, input: CreateProfileInput): Promise<DriverProfile> {
  const existing = await DriverProfile.findOne({ where: { userId } });
  if (existing) {
    throw appError(ErrorCodes.GENERAL.VALIDATION_ERROR, {
      message: 'Driver profile already exists',
    });
  }

  return DriverProfile.create({ userId, ...input });
}

// ── Update Profile ──────────────────────────────────────────────────────────

async function updateProfile(userId: string, input: UpdateProfileInput): Promise<DriverProfile> {
  const profile = await DriverProfile.findOne({ where: { userId } });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  const {
    licenseNumber,
    licenseExpiry,
    cinPhotoFront,
    cinPhotoBack,
    licensePhotoFront,
    licensePhotoBack,
  } = input;
  if (licenseNumber !== undefined) profile.licenseNumber = licenseNumber;
  if (licenseExpiry !== undefined) profile.licenseExpiry = licenseExpiry;
  if (cinPhotoFront !== undefined) profile.cinPhotoFront = cinPhotoFront;
  if (cinPhotoBack !== undefined) profile.cinPhotoBack = cinPhotoBack;
  if (licensePhotoFront !== undefined) profile.licensePhotoFront = licensePhotoFront;
  if (licensePhotoBack !== undefined) profile.licensePhotoBack = licensePhotoBack;
  await profile.save();
  await cacheDel(`driver:${userId}:profile`);
  return profile;
}

// ── Get Profile ─────────────────────────────────────────────────────────────

const DRIVER_PROFILE_CACHE_TTL = 600; // 10 minutes

async function getProfile(userId: string): Promise<DriverProfile> {
  const cacheKey = `driver:${userId}:profile`;
  const cached = await cacheGet<DriverProfile>(cacheKey);
  if (cached) return cached as DriverProfile;

  const profile = await DriverProfile.findOne({
    where: { userId },
    include: [{ model: Vehicle, as: 'vehicle' }],
  });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  await cacheSet(cacheKey, profile.toJSON(), DRIVER_PROFILE_CACHE_TTL);
  return profile;
}

// ── Register Vehicle ────────────────────────────────────────────────────────

async function registerVehicle(userId: string, input: RegisterVehicleInput): Promise<Vehicle> {
  const profile = await DriverProfile.findOne({ where: { userId } });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  const existing = await Vehicle.findOne({ where: { driverId: profile.id } });
  if (existing) {
    throw appError(ErrorCodes.GENERAL.VALIDATION_ERROR, { message: 'Vehicle already registered' });
  }

  return Vehicle.create({ driverId: profile.id, ...input });
}

// ── Update Vehicle ──────────────────────────────────────────────────────────

async function updateVehicle(userId: string, input: UpdateVehicleInput): Promise<Vehicle> {
  const profile = await DriverProfile.findOne({ where: { userId } });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  const vehicle = await Vehicle.findOne({ where: { driverId: profile.id } });
  if (!vehicle) throw appError(ErrorCodes.DRIVER.VEHICLE_NOT_FOUND);

  const { color, vehicleType, doors, seats, photoFront, photoSide, photoBack } = input;
  if (color !== undefined) vehicle.color = color;
  if (vehicleType !== undefined) vehicle.vehicleType = vehicleType;
  if (doors !== undefined) vehicle.doors = doors;
  if (seats !== undefined) vehicle.seats = seats;
  if (photoFront !== undefined) vehicle.photoFront = photoFront;
  if (photoSide !== undefined) vehicle.photoSide = photoSide;
  if (photoBack !== undefined) vehicle.photoBack = photoBack;
  await vehicle.save();
  await cacheDel(`driver:${userId}:profile`);
  return vehicle;
}

// ── Get Vehicle ─────────────────────────────────────────────────────────────

async function getVehicle(userId: string): Promise<Vehicle> {
  const profile = await DriverProfile.findOne({ where: { userId } });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  const vehicle = await Vehicle.findOne({ where: { driverId: profile.id } });
  if (!vehicle) throw appError(ErrorCodes.DRIVER.VEHICLE_NOT_FOUND);
  return vehicle;
}

// ── Toggle Online Status ────────────────────────────────────────────────────

async function toggleOnlineStatus(userId: string, isOnline: boolean): Promise<DriverProfile> {
  const profile = await DriverProfile.findOne({
    where: { userId },
    include: [
      { model: Vehicle, as: 'vehicle', attributes: ['vehicleType'] },
      { model: User, as: 'user', attributes: ['fullName'] },
    ],
  });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);
  if (!profile.isApproved) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_APPROVED);

  profile.isOnline = isOnline;
  profile.lastSeenAt = new Date();
  await profile.save();

  if (isOnline && profile.lastLat != null && profile.lastLng != null) {
    const vehicle = (profile as unknown as { vehicle?: Vehicle }).vehicle;
    const user = (profile as unknown as { user?: User }).user;
    await redisGeo.updateDriverLocation(userId, profile.lastLat, profile.lastLng, {
      vehicleType: vehicle?.vehicleType ?? VehicleType.Economy,
      rating: profile.rating != null ? Number(profile.rating) : null,
      fullName: user?.fullName ?? '',
    });
  } else if (!isOnline) {
    await redisGeo.removeDriver(userId);
  }

  await cacheDel(`driver:${userId}:profile`);
  return profile;
}

// ── Update Location ─────────────────────────────────────────────────────────

async function updateLocation(userId: string, lat: number, lng: number): Promise<void> {
  const profile = await DriverProfile.findOne({
    where: { userId },
    include: [
      { model: Vehicle, as: 'vehicle', attributes: ['vehicleType'] },
      { model: User, as: 'user', attributes: ['fullName'] },
    ],
  });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  profile.lastLat = lat;
  profile.lastLng = lng;
  profile.lastSeenAt = new Date();
  await profile.save();
  await cacheDel(`driver:${userId}:profile`);

  const vehicle = (profile as unknown as { vehicle?: Vehicle }).vehicle;
  const user = (profile as unknown as { user?: User }).user;
  await redisGeo.updateDriverLocation(userId, lat, lng, {
    vehicleType: vehicle?.vehicleType ?? VehicleType.Economy,
    rating: profile.rating != null ? Number(profile.rating) : null,
    fullName: user?.fullName ?? '',
  });
}

// ── Get Nearby Drivers ──────────────────────────────────────────────────────

async function getNearbyDrivers(query: NearbyQuery): Promise<NearbyDriver[]> {
  const radiusKm = Number(query.radiusKm) || 5;
  const lat = Number(query.lat);
  const lng = Number(query.lng);

  // Use Redis geo when available
  if (redisClient.status === 'ready') {
    return redisGeo.getNearbyDrivers(lat, lng, radiusKm, query.vehicleType);
  }

  // SQL fallback when Redis unavailable
  logger.warn('Redis unavailable — falling back to SQL for nearby drivers', {
    component: 'driver-service',
  });
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const where: Record<string, unknown> = {
    isOnline: true,
    isApproved: true,
    lastLat: { [Op.between]: [lat - latDelta, lat + latDelta] },
    lastLng: { [Op.between]: [lng - lngDelta, lng + lngDelta] },
  };

  const vehicleInclude = query.vehicleType
    ? {
        model: Vehicle,
        as: 'vehicle' as const,
        where: { vehicleType: query.vehicleType, isActive: true },
        required: true,
      }
    : { model: Vehicle, as: 'vehicle' as const };

  const profiles = await DriverProfile.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'fullName'] }, vehicleInclude],
  });

  return profiles.map((p) => {
    const user = (p as unknown as { user?: { fullName: string } }).user;
    const vehicle = (p as unknown as { vehicle?: { vehicleType: string } }).vehicle;
    const driverLat = Number(p.lastLat);
    const dLat = (driverLat - lat) * 111;
    const dLng = (Number(p.lastLng) - lng) * 111 * Math.cos((driverLat * Math.PI) / 180);
    return {
      driverId: p.userId,
      distanceKm: Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 100) / 100,
      lat: Number(p.lastLat),
      lng: Number(p.lastLng),
      vehicleType: vehicle?.vehicleType ?? 'economy',
      rating: p.rating != null ? Number(p.rating) : 0,
      fullName: user?.fullName ?? '',
      heading: null,
    };
  });
}

export {
  createProfile,
  getNearbyDrivers,
  getProfile,
  getVehicle,
  registerVehicle,
  toggleOnlineStatus,
  updateLocation,
  updateProfile,
  updateVehicle,
};
export type {
  CreateProfileInput,
  NearbyQuery,
  RegisterVehicleInput,
  UpdateProfileInput,
  UpdateVehicleInput,
};
