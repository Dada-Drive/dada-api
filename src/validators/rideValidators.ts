import { body, param, query } from 'express-validator';

import { ServiceType, VehicleType } from '@/types/enums';
import { coordinateFields, paginationParams, textField, uuidParam } from '@/validators/common';

const fareEstimateValidation = [
  query('vehicleType')
    .isIn(Object.values(VehicleType))
    .withMessage(`Must be one of: ${Object.values(VehicleType).join(', ')}`),
  query('serviceType')
    .optional()
    .isIn(Object.values(ServiceType))
    .withMessage(`Must be one of: ${Object.values(ServiceType).join(', ')}`),
  query('distanceKm').isFloat({ min: 0.1 }).withMessage('Distance must be positive').toFloat(),
  query('estimatedMinutes').isInt({ min: 1 }).withMessage('Must be at least 1 minute').toInt(),
];

const createRideValidation = [
  body('vehicleType')
    .isIn(Object.values(VehicleType))
    .withMessage(`Must be one of: ${Object.values(VehicleType).join(', ')}`),
  ...coordinateFields('pickupLat', 'pickupLng'),
  textField('pickupAddress'),
  ...coordinateFields('dropoffLat', 'dropoffLng'),
  textField('dropoffAddress'),
  body('distanceKm').isFloat({ min: 0.1 }).withMessage('Distance must be positive').toFloat(),
  body('estimatedMinutes').isInt({ min: 1 }).withMessage('Must be at least 1 minute').toInt(),
  body('passengerName').optional().isString().isLength({ max: 100 }).trim(),
  body('passengerPhone').optional().isMobilePhone('any'),
  body('isShared').optional().isBoolean().toBoolean(),
  body('sharedSeatsAvailable').optional().isInt({ min: 1, max: 6 }).toInt(),
  body('scheduledAt').optional().isISO8601().withMessage('Must be a valid ISO 8601 date'),
  body('serviceType')
    .optional()
    .isIn(Object.values(ServiceType))
    .withMessage(`Must be one of: ${Object.values(ServiceType).join(', ')}`),
  body('hideEstimate').optional().isBoolean().toBoolean(),
];

const getRidesValidation = [
  ...paginationParams(),
  query('status').optional().isString(),
  query('vehicleType').optional().isIn(Object.values(VehicleType)),
  query('sort').optional().isString(),
];

const rideIdValidation = [uuidParam('id')];

const acceptRideValidation = [
  uuidParam('id'),
  body('offeredFare')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Must be a positive number')
    .toFloat(),
];

const cancelRideValidation = [
  uuidParam('id'),
  body('reason').optional().isString().isLength({ max: 500 }).trim(),
];

const pickDriverValidation = [
  uuidParam('id'),
  body('offerId').isUUID(4).withMessage('Must be a valid UUID'),
];

const riderRefuseOfferValidation = [
  uuidParam('id'),
  param('offerId').isUUID(4).withMessage('Must be a valid UUID'),
];

export {
  acceptRideValidation,
  cancelRideValidation,
  createRideValidation,
  fareEstimateValidation,
  getRidesValidation,
  pickDriverValidation,
  rideIdValidation,
  riderRefuseOfferValidation,
};
