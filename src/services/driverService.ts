import { Op } from 'sequelize';

import { DriverProfile, User, Vehicle } from '@/models/index';
import { VehicleType } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';

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
  return profile;
}

// ── Get Profile ─────────────────────────────────────────────────────────────

async function getProfile(userId: string): Promise<DriverProfile> {
  const profile = await DriverProfile.findOne({
    where: { userId },
    include: [{ model: Vehicle, as: 'vehicle' }],
  });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);
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
  const profile = await DriverProfile.findOne({ where: { userId } });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);
  if (!profile.isApproved) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_APPROVED);

  profile.isOnline = isOnline;
  profile.lastSeenAt = new Date();
  await profile.save();
  return profile;
}

// ── Update Location ─────────────────────────────────────────────────────────

async function updateLocation(userId: string, lat: number, lng: number): Promise<void> {
  const profile = await DriverProfile.findOne({ where: { userId } });
  if (!profile) throw appError(ErrorCodes.DRIVER.DRIVER_NOT_FOUND);

  profile.lastLat = lat;
  profile.lastLng = lng;
  profile.lastSeenAt = new Date();
  await profile.save();
}

// ── Get Nearby Drivers ──────────────────────────────────────────────────────

async function getNearbyDrivers(query: NearbyQuery): Promise<DriverProfile[]> {
  const radiusKm = Number(query.radiusKm) || 5;
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  // Approximate bounding box: 1 degree ≈ 111km
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const where: Record<string, unknown> = {
    isOnline: true,
    isApproved: true,
    lastLat: { [Op.between]: [lat - latDelta, lat + latDelta] },
    lastLng: { [Op.between]: [lng - lngDelta, lng + lngDelta] },
  };

  if (query.vehicleType) {
    // Filter by vehicle type — need to include vehicle
    return DriverProfile.findAll({
      where,
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          where: { vehicleType: query.vehicleType, isActive: true },
          required: true,
        },
        { model: User, as: 'user', attributes: ['id', 'fullName', 'avatarUrl', 'phone'] },
      ],
    });
  }

  return DriverProfile.findAll({
    where,
    include: [
      { model: Vehicle, as: 'vehicle' },
      { model: User, as: 'user', attributes: ['id', 'fullName', 'avatarUrl', 'phone'] },
    ],
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
