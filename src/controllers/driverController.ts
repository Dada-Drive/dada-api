import { Request, Response } from 'express';

import * as driverService from '@/services/driverService';
import { ServiceType, VehicleType } from '@/types/enums';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '@/utils/responseHelpers';

// ── Profile ─────────────────────────────────────────────────────────────────

const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const profile = await driverService.getProfile(req.user!.userId);
  sendSuccess(res, profile);
});

const createProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as driverService.CreateProfileInput;
  const profile = await driverService.createProfile(req.user!.userId, input);
  sendCreated(res, profile);
});

const updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as driverService.UpdateProfileInput;
  const profile = await driverService.updateProfile(req.user!.userId, input);
  sendSuccess(res, profile);
});

// ── Vehicle ─────────────────────────────────────────────────────────────────

const getVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const vehicle = await driverService.getVehicle(req.user!.userId);
  sendSuccess(res, vehicle);
});

const registerVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as driverService.RegisterVehicleInput;
  const vehicle = await driverService.registerVehicle(req.user!.userId, input);
  sendCreated(res, vehicle);
});

const updateVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as driverService.UpdateVehicleInput;
  const vehicle = await driverService.updateVehicle(req.user!.userId, input);
  sendSuccess(res, vehicle);
});

// ── Status & Location ───────────────────────────────────────────────────────

const toggleStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { isOnline } = req.body as { isOnline: boolean };
  const profile = await driverService.toggleOnlineStatus(req.user!.userId, isOnline);
  sendSuccess(res, profile);
});

const updateLocation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { lat, lng } = req.body as { lat: number; lng: number };
  await driverService.updateLocation(req.user!.userId, lat, lng);
  sendNoContent(res);
});

// ── Nearby ──────────────────────────────────────────────────────────────────

const getNearbyDrivers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { lat, lng, radiusKm, vehicleType } = req.query as unknown as {
    lat: number;
    lng: number;
    radiusKm?: number;
    vehicleType?: VehicleType;
  };

  const drivers = await driverService.getNearbyDrivers({ lat, lng, radiusKm, vehicleType });
  sendSuccess(res, drivers);
});

// ── Service Types ──────────────────────────────────────────────────────────

const getServiceTypes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const types = await driverService.getServiceTypes(req.user!.userId);
  sendSuccess(res, types);
});

const addServiceType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { serviceType } = req.body as { serviceType: ServiceType };
  const entry = await driverService.addServiceType(req.user!.userId, serviceType);
  sendCreated(res, entry);
});

const removeServiceType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { serviceType } = req.params as { serviceType: ServiceType };
  await driverService.removeServiceType(req.user!.userId, serviceType);
  sendNoContent(res);
});

export {
  addServiceType,
  createProfile,
  getNearbyDrivers,
  getProfile,
  getServiceTypes,
  getVehicle,
  registerVehicle,
  removeServiceType,
  toggleStatus,
  updateLocation,
  updateProfile,
  updateVehicle,
};
