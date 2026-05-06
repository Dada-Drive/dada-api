import { body } from 'express-validator';

import { paginationParams, uuidParam } from '@/validators/common';

const submitRatingValidation = [
  uuidParam('rideId'),
  body('score').isInt({ min: 1, max: 5 }).withMessage('Score must be between 1 and 5').toInt(),
  body('comment').optional().isString().isLength({ max: 500 }).trim(),
];

const driverRatingsValidation = [uuidParam('driverId'), ...paginationParams()];

const rideRatingValidation = [uuidParam('rideId')];

export { driverRatingsValidation, rideRatingValidation, submitRatingValidation };
