import { body } from 'express-validator';

import { amountField, paginationParams } from '@/validators/common';

const transactionListValidation = [...paginationParams()];

const initiateTopupValidation = [amountField('amount')];

const confirmTopupValidation = [
  body('transactionId').isUUID(4).withMessage('Must be a valid UUID'),
];

const adminTopupValidation = [
  body('userId').isUUID(4).withMessage('Must be a valid UUID'),
  amountField('amount'),
  body('description').optional().isString().isLength({ max: 500 }).trim(),
];

export {
  adminTopupValidation,
  confirmTopupValidation,
  initiateTopupValidation,
  transactionListValidation,
};
