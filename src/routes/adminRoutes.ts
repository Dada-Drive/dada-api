import { Router } from 'express';

import * as adminController from '@/controllers/adminController';
import { protect, restrictTo } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { UserRole } from '@/types/enums';
import {
  listDriversValidation,
  listRidesValidation,
  listTransactionsValidation,
  listUsersValidation,
  userIdValidation,
} from '@/validators/adminValidators';

const adminRoutes = Router();

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Platform statistics
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Stats }, 403: { description: Admin only } }
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List users (paginated, filterable)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated user list } }
 * /admin/users/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user details
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: User details }, 404: { description: Not found } }
 * /admin/users/{userId}/deactivate:
 *   patch:
 *     tags: [Admin]
 *     summary: Suspend user
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: User suspended } }
 * /admin/users/{userId}/activate:
 *   patch:
 *     tags: [Admin]
 *     summary: Unsuspend user
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: User activated } }
 * /admin/drivers:
 *   get:
 *     tags: [Admin]
 *     summary: List all drivers (paginated)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated driver list } }
 * /admin/drivers/pending:
 *   get:
 *     tags: [Admin]
 *     summary: List pending driver applications
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Pending drivers } }
 * /admin/drivers/{userId}/approve:
 *   patch:
 *     tags: [Admin]
 *     summary: Approve driver application
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Driver approved } }
 * /admin/drivers/{userId}/reject:
 *   patch:
 *     tags: [Admin]
 *     summary: Reject driver application
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Driver rejected } }
 * /admin/rides:
 *   get:
 *     tags: [Admin]
 *     summary: List all rides (paginated)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated ride list } }
 * /admin/transactions:
 *   get:
 *     tags: [Admin]
 *     summary: List all transactions (paginated)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated transaction list } }
 */

// All admin routes require admin role
adminRoutes.use(protect, restrictTo(UserRole.Admin));

adminRoutes.get('/stats', adminController.getStats);

// Users
adminRoutes.get('/users', validate(listUsersValidation), adminController.listUsers);
adminRoutes.get('/users/:userId', validate(userIdValidation), adminController.getUserDetails);
adminRoutes.patch(
  '/users/:userId/deactivate',
  validate(userIdValidation),
  adminController.deactivateUser,
);
adminRoutes.patch(
  '/users/:userId/activate',
  validate(userIdValidation),
  adminController.activateUser,
);

// Drivers
adminRoutes.get('/drivers', validate(listDriversValidation), adminController.listDrivers);
adminRoutes.get(
  '/drivers/pending',
  validate(listDriversValidation),
  adminController.getPendingDrivers,
);
adminRoutes.patch(
  '/drivers/:userId/approve',
  validate(userIdValidation),
  adminController.approveDriver,
);
adminRoutes.patch(
  '/drivers/:userId/reject',
  validate(userIdValidation),
  adminController.rejectDriver,
);

// Rides & Transactions
adminRoutes.get('/rides', validate(listRidesValidation), adminController.listRides);
adminRoutes.get(
  '/transactions',
  validate(listTransactionsValidation),
  adminController.listTransactions,
);

export { adminRoutes };
