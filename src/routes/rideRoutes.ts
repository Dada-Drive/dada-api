import { Router } from 'express';

import * as rideController from '@/controllers/rideController';
import { protect } from '@/middlewares/auth';
import { idempotency } from '@/middlewares/idempotency';
import { validate } from '@/middlewares/validate';
import {
  cancelRideValidation,
  createRideValidation,
  fareEstimateValidation,
  getRidesValidation,
  pickDriverValidation,
  rideIdValidation,
} from '@/validators/rideValidators';

const rideRoutes = Router();

/**
 * @openapi
 * /rides/fare:
 *   get:
 *     tags: [Rides]
 *     summary: Calculate fare estimate
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: vehicleType
 *         required: true
 *         schema: { type: string, enum: [economy, premium, van] }
 *       - in: query
 *         name: distanceKm
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: estimatedMinutes
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: Fare estimate } }
 * /rides:
 *   post:
 *     tags: [Rides]
 *     summary: Request a new ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Ride created }, 400: { description: Validation error } }
 * /rides/my:
 *   get:
 *     tags: [Rides]
 *     summary: Get user rides (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: "createdAt:desc" }
 *     responses: { 200: { description: Paginated ride list } }
 * /rides/available:
 *   get:
 *     tags: [Rides]
 *     summary: Get available rides for drivers (paginated)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated available rides } }
 * /rides/scheduled:
 *   get:
 *     tags: [Rides]
 *     summary: Get scheduled rides
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated scheduled rides } }
 * /rides/{id}:
 *   get:
 *     tags: [Rides]
 *     summary: Get ride details
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses: { 200: { description: Ride details }, 404: { description: Not found } }
 * /rides/{id}/offers:
 *   get:
 *     tags: [Rides]
 *     summary: Get offers for a ride
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses: { 200: { description: Ride offers } }
 * /rides/{id}/accept:
 *   post:
 *     tags: [Rides]
 *     summary: Driver creates an offer for a ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Offer created, ride status set to offered }, 409: { description: Already offered } }
 * /rides/{id}/pick-driver:
 *   post:
 *     tags: [Rides]
 *     summary: Rider picks a driver from pending offers
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               offerId: { type: string, format: uuid }
 *             required: [offerId]
 *     responses: { 200: { description: Driver selected, ride accepted }, 404: { description: Offer not found } }
 * /rides/{id}/refuse:
 *   post:
 *     tags: [Rides]
 *     summary: Driver refuses ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Ride refused } }
 * /rides/{id}/arrive:
 *   patch:
 *     tags: [Rides]
 *     summary: Driver arrives at pickup
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Arrival recorded } }
 * /rides/{id}/start:
 *   patch:
 *     tags: [Rides]
 *     summary: Start ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Ride started } }
 * /rides/{id}/complete:
 *   patch:
 *     tags: [Rides]
 *     summary: Complete ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Ride completed } }
 * /rides/{id}/cancel:
 *   patch:
 *     tags: [Rides]
 *     summary: Cancel ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Ride cancelled }, 400: { description: Invalid status } }
 */

// Fare estimate
rideRoutes.get('/fare', protect, validate(fareEstimateValidation), rideController.getFareEstimate);

// CRUD
rideRoutes.post(
  '/',
  protect,
  idempotency(),
  validate(createRideValidation),
  rideController.createRide,
);
rideRoutes.get('/my', protect, validate(getRidesValidation), rideController.getMyRides);
rideRoutes.get(
  '/available',
  protect,
  validate(getRidesValidation),
  rideController.getAvailableRides,
);
rideRoutes.get(
  '/scheduled',
  protect,
  validate(getRidesValidation),
  rideController.getScheduledRides,
);
rideRoutes.get('/:id', protect, validate(rideIdValidation), rideController.getRideDetails);
rideRoutes.get('/:id/offers', protect, validate(rideIdValidation), rideController.getRideOffers);

// Lifecycle
rideRoutes.post(
  '/:id/accept',
  protect,
  idempotency(),
  validate(rideIdValidation),
  rideController.acceptRide,
);
rideRoutes.post(
  '/:id/pick-driver',
  protect,
  validate(pickDriverValidation),
  rideController.pickDriver,
);
rideRoutes.post('/:id/refuse', protect, validate(rideIdValidation), rideController.refuseRide);
rideRoutes.patch('/:id/arrive', protect, validate(rideIdValidation), rideController.arriveAtPickup);
rideRoutes.patch('/:id/start', protect, validate(rideIdValidation), rideController.startRide);
rideRoutes.patch('/:id/complete', protect, validate(rideIdValidation), rideController.completeRide);
rideRoutes.patch('/:id/cancel', protect, validate(cancelRideValidation), rideController.cancelRide);

export { rideRoutes };
