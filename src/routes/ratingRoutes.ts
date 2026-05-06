import { Router } from 'express';

import * as ratingController from '@/controllers/ratingController';
import { protect } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  driverRatingsValidation,
  rideRatingValidation,
  submitRatingValidation,
} from '@/validators/ratingValidators';

const ratingRoutes = Router();

/**
 * @openapi
 * /ratings/rides/{rideId}:
 *   post:
 *     tags: [Ratings]
 *     summary: Submit rating for a ride
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [score]
 *             properties:
 *               score: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, maxLength: 500 }
 *     responses: { 201: { description: Rating submitted }, 409: { description: Already rated } }
 *   get:
 *     tags: [Ratings]
 *     summary: Get rating for a ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Ride rating }, 404: { description: Not found } }
 * /ratings/drivers/{driverId}:
 *   get:
 *     tags: [Ratings]
 *     summary: Get driver ratings (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses: { 200: { description: Paginated driver ratings } }
 */

ratingRoutes.post(
  '/rides/:rideId',
  protect,
  validate(submitRatingValidation),
  ratingController.submitRating,
);
ratingRoutes.get(
  '/rides/:rideId',
  protect,
  validate(rideRatingValidation),
  ratingController.getRideRating,
);
ratingRoutes.get(
  '/drivers/:driverId',
  protect,
  validate(driverRatingsValidation),
  ratingController.getDriverRatings,
);

export { ratingRoutes };
