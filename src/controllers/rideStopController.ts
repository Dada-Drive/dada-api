import { Request, Response } from 'express';

import * as rideStopService from '@/services/rideStopService';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@/utils/responseHelpers';

const getStops = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const stops = await rideStopService.getStops(req.params.id as string);
  sendSuccess(res, stops);
});

const addStops = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { stops } = req.body as { stops: rideStopService.AddStopInput[] };
  const result = await rideStopService.addStops(req.params.id as string, stops);
  sendCreated(res, result);
});

const markArrival = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const stop = await rideStopService.markArrival(
    req.params.id as string,
    req.params.stopId as string,
  );
  sendSuccess(res, stop);
});

const markDeparture = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const stop = await rideStopService.markDeparture(
    req.params.id as string,
    req.params.stopId as string,
  );
  sendSuccess(res, stop);
});

export { addStops, getStops, markArrival, markDeparture };
