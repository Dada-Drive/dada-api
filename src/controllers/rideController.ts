import { Request, Response } from 'express';

import * as rideService from '@/services/rideService';
import { ServiceType, VehicleType } from '@/types/enums';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendPaginated, sendSuccess } from '@/utils/responseHelpers';

// ── Fare Estimate ───────────────────────────────────────────────────────────

const getFareEstimate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { vehicleType, serviceType, distanceKm, estimatedMinutes } = req.query as unknown as {
    vehicleType: VehicleType;
    serviceType?: ServiceType;
    distanceKm: number;
    estimatedMinutes: number;
  };

  const result = await rideService.calculateFare({
    vehicleType,
    serviceType,
    distanceKm,
    estimatedMinutes,
  });
  sendSuccess(res, result);
});

// ── Create Ride ─────────────────────────────────────────────────────────────

const createRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as rideService.CreateRideInput;
  const ride = await rideService.requestRide(req.user!.userId, input);
  sendCreated(res, ride);
});

// ── Get My Rides ────────────────────────────────────────────────────────────

const getMyRides = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await rideService.getMyRides(
    req.user!.userId,
    req.query as Record<string, unknown>,
  );
  sendPaginated(res, rows, meta);
});

// ── Get Available Rides ─────────────────────────────────────────────────────

const getAvailableRides = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await rideService.getAvailableRides(req.query as Record<string, unknown>);
  sendPaginated(res, rows, meta);
});

// ── Get Scheduled Rides ─────────────────────────────────────────────────────

const getScheduledRides = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await rideService.getScheduledRides(
    req.user!.userId,
    req.query as Record<string, unknown>,
  );
  sendPaginated(res, rows, meta);
});

// ── Get Ride Details ────────────────────────────────────────────────────────

const getRideDetails = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const ride = await rideService.getRideDetails(req.params.id as string, req.user!.userId);
  sendSuccess(res, ride);
});

// ── Get Ride Offers ─────────────────────────────────────────────────────────

const getRideOffers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const offers = await rideService.getRideOffers(req.params.id as string, req.user!.userId);
  sendSuccess(res, offers);
});

// ── Lifecycle Actions ───────────────────────────────────────────────────────

const acceptRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const offeredFare = (req.body as { offeredFare?: number } | undefined)?.offeredFare;
  const result = await rideService.acceptRide(
    req.params.id as string,
    req.user!.userId,
    offeredFare,
  );
  sendSuccess(res, result);
});

const pickDriver = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { offerId } = req.body as { offerId: string };
  const ride = await rideService.pickDriver(req.params.id as string, req.user!.userId, offerId);
  sendSuccess(res, ride);
});

const refuseRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await rideService.refuseRide(req.params.id as string, req.user!.userId);
  sendSuccess(res, { refused: true });
});

const riderRefuseOffer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await rideService.riderRefuseOffer(
    req.params.id as string,
    req.user!.userId,
    req.params.offerId as string,
  );
  sendSuccess(res, { refused: true });
});

const arriveAtPickup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const ride = await rideService.arriveAtPickup(req.params.id as string, req.user!.userId);
  sendSuccess(res, ride);
});

const startRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const ride = await rideService.startRide(req.params.id as string, req.user!.userId);
  sendSuccess(res, ride);
});

const completeRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const ride = await rideService.completeRide(req.params.id as string, req.user!.userId);
  sendSuccess(res, ride);
});

const cancelRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { reason } = req.body as { reason?: string };
  const ride = await rideService.cancelRide(req.params.id as string, req.user!.userId, reason);
  sendSuccess(res, ride);
});

export {
  acceptRide,
  arriveAtPickup,
  cancelRide,
  completeRide,
  createRide,
  getAvailableRides,
  getFareEstimate,
  getMyRides,
  getRideDetails,
  getRideOffers,
  getScheduledRides,
  pickDriver,
  refuseRide,
  riderRefuseOffer,
  startRide,
};
