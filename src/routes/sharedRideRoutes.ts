import { Router } from 'express';

import * as sharedRideController from '@/controllers/sharedRideController';
import { protect } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { uuidParam } from '@/validators/common';
import {
  availableSharedRidesValidation,
  joinSharedRideValidation,
  passengerActionValidation,
} from '@/validators/sharedRideValidators';

const sharedRideRoutes = Router();

/**
 * @openapi
 * /shared-rides/available:
 *   get:
 *     tags: [Shared Rides]
 *     summary: Find available shared rides (paginated)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Available shared rides } }
 * /shared-rides/{id}/join:
 *   post:
 *     tags: [Shared Rides]
 *     summary: Join a shared ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Joined shared ride }, 400: { description: No seats } }
 * /shared-rides/{id}/passengers:
 *   get:
 *     tags: [Shared Rides]
 *     summary: Get passengers for shared ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Passenger list } }
 * /shared-rides/{id}/passengers/{passengerId}/pickup:
 *   patch:
 *     tags: [Shared Rides]
 *     summary: Mark passenger as picked up
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Pickup marked } }
 * /shared-rides/{id}/passengers/{passengerId}/dropoff:
 *   patch:
 *     tags: [Shared Rides]
 *     summary: Mark passenger as dropped off
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Dropoff marked } }
 * /shared-rides/{id}/leave:
 *   delete:
 *     tags: [Shared Rides]
 *     summary: Leave shared ride
 *     security: [{ bearerAuth: [] }]
 *     responses: { 204: { description: Left shared ride } }
 */

sharedRideRoutes.get(
  '/available',
  protect,
  validate(availableSharedRidesValidation),
  sharedRideController.getAvailableSharedRides,
);
sharedRideRoutes.post(
  '/:id/join',
  protect,
  validate(joinSharedRideValidation),
  sharedRideController.joinSharedRide,
);
sharedRideRoutes.get(
  '/:id/passengers',
  protect,
  validate([uuidParam('id')]),
  sharedRideController.getPassengers,
);
sharedRideRoutes.patch(
  '/:id/passengers/:passengerId/pickup',
  protect,
  validate(passengerActionValidation),
  sharedRideController.markPickedUp,
);
sharedRideRoutes.patch(
  '/:id/passengers/:passengerId/dropoff',
  protect,
  validate(passengerActionValidation),
  sharedRideController.markDroppedOff,
);
sharedRideRoutes.delete(
  '/:id/leave',
  protect,
  validate([uuidParam('id')]),
  sharedRideController.leaveSharedRide,
);

export { sharedRideRoutes };
