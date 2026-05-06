import { paginationParams, uuidParam } from '@/validators/common';

const listUsersValidation = paginationParams();
const userIdValidation = [uuidParam('userId')];
const listDriversValidation = paginationParams();
const listRidesValidation = paginationParams();
const listTransactionsValidation = paginationParams();

export {
  listDriversValidation,
  listRidesValidation,
  listTransactionsValidation,
  listUsersValidation,
  userIdValidation,
};
