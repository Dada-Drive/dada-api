import { Router } from 'express';

import * as driverController from '@/controllers/driverController';
import { protect } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  createProfileValidation,
  nearbyQueryValidation,
  registerVehicleValidation,
  statusToggleValidation,
  updateLocationValidation,
  updateProfileValidation,
  updateVehicleValidation,
} from '@/validators/driverValidators';

const driverRoutes = Router();

/**
 * @openapi
 * /driver/profile:
 *   get:
 *     tags: [Driver]
 *     summary: Get driver profile with vehicle
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Driver profile }, 404: { description: Not found } }
 *   post:
 *     tags: [Driver]
 *     summary: Create driver profile
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Profile created }, 400: { description: Validation error } }
 *   patch:
 *     tags: [Driver]
 *     summary: Update driver profile
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Profile updated } }
 * /driver/vehicle:
 *   get:
 *     tags: [Driver]
 *     summary: Get driver vehicle
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Vehicle details }, 404: { description: Not found } }
 *   post:
 *     tags: [Driver]
 *     summary: Register vehicle
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Vehicle registered } }
 *   patch:
 *     tags: [Driver]
 *     summary: Update vehicle
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Vehicle updated } }
 * /driver/status:
 *   patch:
 *     tags: [Driver]
 *     summary: Toggle online/offline status
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Status updated }, 403: { description: Not approved } }
 * /driver/location:
 *   patch:
 *     tags: [Driver]
 *     summary: Update GPS location
 *     security: [{ bearerAuth: [] }]
 *     responses: { 204: { description: Location updated } }
 * /driver/nearby:
 *   get:
 *     tags: [Driver]
 *     summary: Find nearby drivers
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: radiusKm
 *         schema: { type: number, default: 5 }
 *       - in: query
 *         name: vehicleType
 *         schema: { type: string, enum: [economy, premium, van] }
 *     responses: { 200: { description: List of nearby drivers } }
 */

// Profile
driverRoutes.get('/profile', protect, driverController.getProfile);
driverRoutes.post(
  '/profile',
  protect,
  validate(createProfileValidation),
  driverController.createProfile,
);
driverRoutes.patch(
  '/profile',
  protect,
  validate(updateProfileValidation),
  driverController.updateProfile,
);

// Vehicle
driverRoutes.get('/vehicle', protect, driverController.getVehicle);
driverRoutes.post(
  '/vehicle',
  protect,
  validate(registerVehicleValidation),
  driverController.registerVehicle,
);
driverRoutes.patch(
  '/vehicle',
  protect,
  validate(updateVehicleValidation),
  driverController.updateVehicle,
);

// Status & Location
driverRoutes.patch(
  '/status',
  protect,
  validate(statusToggleValidation),
  driverController.toggleStatus,
);
driverRoutes.patch(
  '/location',
  protect,
  validate(updateLocationValidation),
  driverController.updateLocation,
);

// Nearby (any authenticated user can query)
driverRoutes.get(
  '/nearby',
  protect,
  validate(nearbyQueryValidation),
  driverController.getNearbyDrivers,
);

export { driverRoutes };
