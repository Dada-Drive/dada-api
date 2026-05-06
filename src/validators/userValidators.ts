import { body } from 'express-validator';

import { phoneField, textField } from '@/validators/common';

const updateProfileValidation = [
  textField('fullName', 100).optional(),
  body('email')
    .optional({ values: 'null' })
    .isEmail()
    .withMessage('Must be a valid email')
    .normalizeEmail(),
  body('avatarUrl').optional({ values: 'null' }).isString().trim(),
];

const updatePhoneValidation = [phoneField('phone')];

const setRoleValidation = [
  body('role').isIn(['pending']).withMessage('Can only switch to pending (driver application)'),
];

export { setRoleValidation, updatePhoneValidation, updateProfileValidation };
