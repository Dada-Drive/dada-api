import { Op, fn, col, literal } from 'sequelize';

import { redisClient } from '@/config/redis';
import {
  DriverProfile,
  DriverServiceType,
  Rating,
  Ride,
  User,
  Vehicle,
  Wallet,
} from '@/models/index';
import { cacheDel, cacheGet, cacheSet } from '@/services/cacheService';
import * as redisGeo from '@/services/redisGeoService';
import { RideStatus, ServiceType, VehicleType } from '@/types/enums';
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
    const driverSvcTypes = await DriverServiceType.findAll({
      where: { driverId: userId },
      attributes: ['serviceType'],
    });
    const svcTypesStr = driverSvcTypes.map((s) => s.serviceType).join(',');
    await redisGeo.updateDriverLocation(userId, profile.lastLat, profile.lastLng, {
      vehicleType: vehicle?.vehicleType ?? VehicleType.Economy,
      serviceTypes: svcTypesStr,
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
  const driverSvcTypes = await DriverServiceType.findAll({
    where: { driverId: userId },
    attributes: ['serviceType'],
  });
  const svcTypesStr = driverSvcTypes.map((s) => s.serviceType).join(',');
  await redisGeo.updateDriverLocation(userId, lat, lng, {
    vehicleType: vehicle?.vehicleType ?? VehicleType.Economy,
    serviceTypes: svcTypesStr,
    rating: profile.rating != null ? Number(profile.rating) : null,
    fullName: user?.fullName ?? '',
  });
}

// ── Driver Service Types ───────────────────────────────────────────────────

async function getServiceTypes(userId: string): Promise<DriverServiceType[]> {
  return DriverServiceType.findAll({ where: { driverId: userId } });
}

async function addServiceType(
  userId: string,
  serviceType: ServiceType,
): Promise<DriverServiceType> {
  const existing = await DriverServiceType.findOne({
    where: { driverId: userId, serviceType },
  });
  if (existing) {
    throw appError(ErrorCodes.GENERAL.VALIDATION_ERROR, {
      message: `Already registered for service type: ${serviceType}`,
    });
  }
  return DriverServiceType.create({ driverId: userId, serviceType });
}

async function removeServiceType(userId: string, serviceType: ServiceType): Promise<void> {
  const count = await DriverServiceType.destroy({
    where: { driverId: userId, serviceType },
  });
  if (count === 0) {
    throw appError(ErrorCodes.GENERAL.NOT_FOUND, {
      message: `Not registered for service type: ${serviceType}`,
    });
  }
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

// ── Driver Stats ──────────────────────────────────────────────────────────

const DRIVER_STATS_CACHE_TTL = 300; // 5 minutes

type StatsPeriod = 'today' | 'week' | 'month';

interface DriverStatsResult {
  session: {
    earnings: number;
    ridesCompleted: number;
    kmDriven: number;
    onlineDuration: number;
  };
  allTime: {
    totalRides: number;
    rating: number;
    walletBalance: number;
  };
  dailyEarnings: number[];
  totalEarnings: number;
  dateRange: { start: string; end: string };
  trends: {
    earnings: number | null;
    rides: number | null;
    hours: number | null;
    distance: number | null;
  };
}

function getPeriodRange(period: StatsPeriod): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  const prevStart = new Date(now);
  const prevEnd = new Date(now);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart.setDate(prevStart.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      break;
    case 'week': {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setDate(now.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart.setDate(start.getDate() - 7);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(start.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      break;
    }
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart.setMonth(prevStart.getMonth() - 1);
      prevStart.setDate(1);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(0); // last day of previous month
      prevEnd.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end, prevStart, prevEnd };
}

function computeTrend(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function getSessionAgg(
  userId: string,
  from: Date,
  to: Date,
): Promise<{
  earnings: string;
  ridesCompleted: string;
  kmDriven: string;
  onlineDuration: string;
} | null> {
  return Ride.findOne({
    attributes: [
      [
        fn(
          'COALESCE',
          fn(
            'SUM',
            literal('COALESCE("final_fare", "calculated_fare") - COALESCE("commission_amount", 0)'),
          ),
          0,
        ),
        'earnings',
      ],
      [fn('COUNT', col('id')), 'ridesCompleted'],
      [fn('COALESCE', fn('SUM', col('distance_km')), 0), 'kmDriven'],
      [
        fn(
          'COALESCE',
          fn('SUM', literal('EXTRACT(EPOCH FROM ("completed_at" - "started_at"))')),
          0,
        ),
        'onlineDuration',
      ],
    ],
    where: {
      driverId: userId,
      status: RideStatus.Completed,
      completedAt: { [Op.between]: [from, to] },
    },
    raw: true,
  }) as unknown as {
    earnings: string;
    ridesCompleted: string;
    kmDriven: string;
    onlineDuration: string;
  } | null;
}

async function getDailyEarnings(userId: string, from: Date, to: Date): Promise<number[]> {
  const rows = (await Ride.findAll({
    attributes: [
      [literal('DATE("completed_at")'), 'day'],
      [
        fn(
          'COALESCE',
          fn(
            'SUM',
            literal('COALESCE("final_fare", "calculated_fare") - COALESCE("commission_amount", 0)'),
          ),
          0,
        ),
        'earnings',
      ],
    ],
    where: {
      driverId: userId,
      status: RideStatus.Completed,
      completedAt: { [Op.between]: [from, to] },
    },
    group: [literal('DATE("completed_at")') as unknown as string],
    order: [[literal('DATE("completed_at")'), 'ASC']],
    raw: true,
  })) as unknown as { day: string; earnings: string }[];

  // Build a map of day -> earnings
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.day, parseFloat(row.earnings) || 0);
  }

  // Generate array for each day in range
  const result: number[] = [];
  const current = new Date(from);
  while (current <= to) {
    const key = current.toISOString().slice(0, 10);
    result.push(map.get(key) || 0);
    current.setDate(current.getDate() + 1);
  }

  // For 'week' and 'month', cap at 7 most recent days for the bar chart
  if (result.length > 7) {
    return result.slice(-7);
  }
  return result;
}

async function getStats(userId: string, period: StatsPeriod = 'today'): Promise<DriverStatsResult> {
  const cacheKey = `driver:${userId}:stats:${period}`;
  const cached = await cacheGet<DriverStatsResult>(cacheKey);
  if (cached) return cached as DriverStatsResult;

  const { start, end, prevStart, prevEnd } = getPeriodRange(period);

  const [sessionAgg, prevAgg, dailyEarnings, totalRides, ratingAgg, wallet] = await Promise.all([
    getSessionAgg(userId, start, end),
    getSessionAgg(userId, prevStart, prevEnd),
    getDailyEarnings(userId, start, end),
    Ride.count({
      where: { driverId: userId, status: RideStatus.Completed },
    }),
    Rating.findOne({
      attributes: [[fn('COALESCE', fn('AVG', col('score')), 0), 'avgRating']],
      where: { driverId: userId },
      raw: true,
    }) as unknown as { avgRating: string } | null,
    Wallet.findOne({
      where: { ownerId: userId },
      attributes: ['balance'],
      raw: true,
    }),
  ]);

  const earnings = parseFloat(sessionAgg?.earnings ?? '0') || 0;
  const ridesCompleted = parseInt(sessionAgg?.ridesCompleted ?? '0', 10) || 0;
  const kmDriven = parseFloat(sessionAgg?.kmDriven ?? '0') || 0;
  const onlineDuration = parseFloat(sessionAgg?.onlineDuration ?? '0') || 0;

  const prevEarnings = parseFloat(prevAgg?.earnings ?? '0') || 0;
  const prevRides = parseInt(prevAgg?.ridesCompleted ?? '0', 10) || 0;
  const prevKm = parseFloat(prevAgg?.kmDriven ?? '0') || 0;
  const prevDuration = parseFloat(prevAgg?.onlineDuration ?? '0') || 0;

  const result: DriverStatsResult = {
    session: { earnings, ridesCompleted, kmDriven, onlineDuration },
    allTime: {
      totalRides,
      rating: parseFloat(ratingAgg?.avgRating ?? '0') || 0,
      walletBalance: wallet ? parseFloat(String(wallet.balance)) || 0 : 0,
    },
    dailyEarnings,
    totalEarnings: earnings,
    dateRange: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    },
    trends: {
      earnings: computeTrend(earnings, prevEarnings),
      rides: computeTrend(ridesCompleted, prevRides),
      hours: computeTrend(onlineDuration, prevDuration),
      distance: computeTrend(kmDriven, prevKm),
    },
  };

  await cacheSet(cacheKey, result, DRIVER_STATS_CACHE_TTL);
  return result;
}

export {
  addServiceType,
  createProfile,
  getNearbyDrivers,
  getProfile,
  getServiceTypes,
  getStats,
  getVehicle,
  registerVehicle,
  removeServiceType,
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
