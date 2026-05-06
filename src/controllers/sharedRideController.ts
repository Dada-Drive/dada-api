import { Request, Response } from 'express';

import * as sharedRideService from '@/services/sharedRideService';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendNoContent, sendPaginated, sendSuccess } from '@/utils/responseHelpers';

const getAvailableSharedRides = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await sharedRideService.getAvailableSharedRides(
    req.query as Record<string, unknown>,
  );
  sendPaginated(res, rows, meta);
});

const joinSharedRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as sharedRideService.JoinSharedRideInput;
  const passenger = await sharedRideService.joinSharedRide(
    req.params.id as string,
    req.user!.userId,
    input,
  );
  sendCreated(res, passenger);
});

const getPassengers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const passengers = await sharedRideService.getPassengers(req.params.id as string);
  sendSuccess(res, passengers);
});

const markPickedUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const passenger = await sharedRideService.markPickedUp(
    req.params.id as string,
    req.params.passengerId as string,
    req.user!.userId,
  );
  sendSuccess(res, passenger);
});

const markDroppedOff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const passenger = await sharedRideService.markDroppedOff(
    req.params.id as string,
    req.params.passengerId as string,
    req.user!.userId,
  );
  sendSuccess(res, passenger);
});

const leaveSharedRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await sharedRideService.leaveSharedRide(req.params.id as string, req.user!.userId);
  sendNoContent(res);
});

export {
  getAvailableSharedRides,
  getPassengers,
  joinSharedRide,
  leaveSharedRide,
  markDroppedOff,
  markPickedUp,
};
