import { Router } from 'express';

import * as userController from '@/controllers/userController';
import { protect } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  setRoleValidation,
  updatePhoneValidation,
  updateProfileValidation,
} from '@/validators/userValidators';

const userRoutes = Router();

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get own profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 *   patch:
 *     tags: [Users]
 *     summary: Update profile (name, email, avatar)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, maxLength: 100 }
 *               email: { type: string, format: email, nullable: true }
 *               avatarUrl: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Updated profile
 *   delete:
 *     tags: [Users]
 *     summary: Deactivate own account
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204:
 *         description: Account deactivated
 * /users/me/role:
 *   patch:
 *     tags: [Users]
 *     summary: Set user role
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [rider, driver] }
 *     responses:
 *       200:
 *         description: Role updated
 * /users/me/phone:
 *   patch:
 *     tags: [Users]
 *     summary: Update phone number
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Phone updated
 *       409:
 *         description: Phone already in use
 */
userRoutes.get('/me', protect, userController.getProfile);
userRoutes.patch('/me', protect, validate(updateProfileValidation), userController.updateProfile);
userRoutes.delete('/me', protect, userController.deactivateAccount);
userRoutes.patch('/me/role', protect, validate(setRoleValidation), userController.setRole);
userRoutes.patch('/me/phone', protect, validate(updatePhoneValidation), userController.updatePhone);

export { userRoutes };
