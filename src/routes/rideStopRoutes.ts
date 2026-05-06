import { Router } from 'express';
import { body } from 'express-validator';

import * as rideStopController from '@/controllers/rideStopController';
import { protect } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { uuidParam } from '@/validators/common';

const rideStopRoutes = Router({ mergeParams: true });

/**
 * @openapi
 * /rides/{id}/stops:
 *   get:
 *     tags: [Ride Stops]
 *     summary: Get all stops for a ride
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses: { 200: { description: List of stops } }
 *   post:
 *     tags: [Ride Stops]
 *     summary: Add stops to a ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Stops added } }
 * /rides/{id}/stops/{stopId}/arrive:
 *   patch:
 *     tags: [Ride Stops]
 *     summary: Mark arrival at stop
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Arrival marked } }
 * /rides/{id}/stops/{stopId}/leave:
 *   patch:
 *     tags: [Ride Stops]
 *     summary: Mark departure from stop
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Departure marked } }
 */

const stopIdValidation = [uuidParam('id'), uuidParam('stopId')];

const addStopsValidation = [
  uuidParam('id'),
  body('stops').isArray({ min: 1 }).withMessage('At least one stop is required'),
  body('stops.*.address').isString().isLength({ max: 500 }).trim(),
  body('stops.*.lat').isFloat({ min: -90, max: 90 }),
  body('stops.*.lng').isFloat({ min: -180, max: 180 }),
  body('stops.*.orderIndex').isInt({ min: 0 }),
];

rideStopRoutes.get('/', protect, validate([uuidParam('id')]), rideStopController.getStops);
rideStopRoutes.post('/', protect, validate(addStopsValidation), rideStopController.addStops);
rideStopRoutes.patch(
  '/:stopId/arrive',
  protect,
  validate(stopIdValidation),
  rideStopController.markArrival,
);
rideStopRoutes.patch(
  '/:stopId/leave',
  protect,
  validate(stopIdValidation),
  rideStopController.markDeparture,
);

export { rideStopRoutes };
