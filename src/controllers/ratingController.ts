import { Request, Response } from 'express';

import * as ratingService from '@/services/ratingService';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated, sendPaginated, sendSuccess } from '@/utils/responseHelpers';

const submitRating = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { score, comment } = req.body as { score: number; comment?: string };
  const rating = await ratingService.submitRating(
    req.params.rideId as string,
    req.user!.userId,
    score,
    comment,
  );
  sendCreated(res, rating);
});

const getRideRating = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rating = await ratingService.getRideRating(req.params.rideId as string);
  sendSuccess(res, rating);
});

const getDriverRatings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await ratingService.getDriverRatings(
    req.params.driverId as string,
    req.query as Record<string, unknown>,
  );
  sendPaginated(res, rows, meta);
});

export { getDriverRatings, getRideRating, submitRating };
