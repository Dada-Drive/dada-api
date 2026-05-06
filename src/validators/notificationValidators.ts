import { body } from 'express-validator';

import { DevicePlatform } from '@/types/enums';

const registerTokenValidation = [
  body('token').isString().notEmpty().withMessage('Device token is required'),
  body('platform')
    .isIn(Object.values(DevicePlatform))
    .withMessage(`Must be one of: ${Object.values(DevicePlatform).join(', ')}`),
];

const deleteTokenValidation = [
  body('token').isString().notEmpty().withMessage('Device token is required'),
];

export { deleteTokenValidation, registerTokenValidation };
