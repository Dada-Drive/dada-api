import { body, query } from 'express-validator';

import { VehicleType } from '@/types/enums';
import { coordinateFields, textField } from '@/validators/common';

const createProfileValidation = [
  textField('licenseNumber', 50),
  body('licenseExpiry').isDate().withMessage('Must be a valid date (YYYY-MM-DD)'),
  textField('cin', 20),
  body('cinDeliveredAt').isDate().withMessage('Must be a valid date (YYYY-MM-DD)'),
  body('cinPhotoFront').optional().isString().trim(),
  body('cinPhotoBack').optional().isString().trim(),
  body('licensePhotoFront').optional().isString().trim(),
  body('licensePhotoBack').optional().isString().trim(),
];

const updateProfileValidation = [
  textField('licenseNumber', 50).optional(),
  body('licenseExpiry').optional().isDate().withMessage('Must be a valid date (YYYY-MM-DD)'),
  body('cinPhotoFront').optional().isString().trim(),
  body('cinPhotoBack').optional().isString().trim(),
  body('licensePhotoFront').optional().isString().trim(),
  body('licensePhotoBack').optional().isString().trim(),
];

const registerVehicleValidation = [
  textField('make', 50),
  textField('model', 50),
  body('year').optional().isInt({ min: 1990, max: 2100 }).toInt().withMessage('Invalid year'),
  textField('plateNumber', 20),
  textField('color', 30),
  body('vehicleType')
    .optional()
    .isIn(Object.values(VehicleType))
    .withMessage(`Must be one of: ${Object.values(VehicleType).join(', ')}`),
  body('doors').optional().isInt({ min: 1, max: 10 }).toInt(),
  body('seats').optional().isInt({ min: 1, max: 20 }).toInt(),
  body('photoFront').optional().isString().trim(),
  body('photoSide').optional().isString().trim(),
  body('photoBack').optional().isString().trim(),
];

const updateVehicleValidation = [
  textField('color', 30).optional(),
  body('vehicleType')
    .optional()
    .isIn(Object.values(VehicleType))
    .withMessage(`Must be one of: ${Object.values(VehicleType).join(', ')}`),
  body('doors').optional().isInt({ min: 1, max: 10 }).toInt(),
  body('seats').optional().isInt({ min: 1, max: 20 }).toInt(),
  body('photoFront').optional().isString().trim(),
  body('photoSide').optional().isString().trim(),
  body('photoBack').optional().isString().trim(),
];

const updateLocationValidation = coordinateFields('lat', 'lng');

const nearbyQueryValidation = [
  query('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90')
    .toFloat(),
  query('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
    .toFloat(),
  query('radiusKm')
    .optional()
    .isFloat({ min: 0.1, max: 50 })
    .withMessage('Radius must be between 0.1 and 50 km')
    .toFloat(),
  query('vehicleType')
    .optional()
    .isIn(Object.values(VehicleType))
    .withMessage(`Must be one of: ${Object.values(VehicleType).join(', ')}`),
];

const statusToggleValidation = [body('isOnline').isBoolean().withMessage('Must be a boolean')];

export {
  createProfileValidation,
  nearbyQueryValidation,
  registerVehicleValidation,
  statusToggleValidation,
  updateLocationValidation,
  updateProfileValidation,
  updateVehicleValidation,
};
