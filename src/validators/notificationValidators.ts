import { body } from 'express-validator';

import { DevicePlatform } from '@/types/enums';
import { uuidParam } from '@/validators/common';

const registerTokenValidation = [
  body('token').isString().notEmpty().withMessage('Device token is required'),
  body('platform')
    .isIn(Object.values(DevicePlatform))
    .withMessage(`Must be one of: ${Object.values(DevicePlatform).join(', ')}`),
];

const deleteTokenValidation = [
  body('token').isString().notEmpty().withMessage('Device token is required'),
];

const markAsReadValidation = [uuidParam('id')];

const refreshTokenValidation = [
  body('oldToken').isString().notEmpty().withMessage('Old device token is required'),
  body('newToken').isString().notEmpty().withMessage('New device token is required'),
];

export {
  deleteTokenValidation,
  markAsReadValidation,
  refreshTokenValidation,
  registerTokenValidation,
};
