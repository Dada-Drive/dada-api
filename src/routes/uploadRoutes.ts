import { Router } from 'express';

import * as uploadController from '@/controllers/uploadController';
import { protect } from '@/middlewares/auth';
import { uploadLimiter } from '@/middlewares/rateLimiter';
import { avatarUpload, documentUpload, vehiclePhotoUpload } from '@/middlewares/upload';

const uploadRoutes = Router();

/**
 * @openapi
 * /upload/avatar:
 *   post:
 *     tags: [Upload]
 *     summary: Upload user avatar (1 file, max 2MB)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses: { 201: { description: Upload result with URL }, 400: { description: Invalid file type }, 413: { description: File too large } }
 * /upload/document:
 *   post:
 *     tags: [Upload]
 *     summary: Upload driver documents (up to 4 files, max 5MB each)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documents:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses: { 201: { description: Upload results }, 400: { description: Invalid file type } }
 * /upload/vehicle:
 *   post:
 *     tags: [Upload]
 *     summary: Upload vehicle photos (up to 3 files, max 5MB each)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photos:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses: { 201: { description: Upload results }, 400: { description: Invalid file type } }
 */

uploadRoutes.post('/avatar', protect, uploadLimiter, avatarUpload, uploadController.uploadAvatar);
uploadRoutes.post(
  '/document',
  protect,
  uploadLimiter,
  documentUpload,
  uploadController.uploadDocuments,
);
uploadRoutes.post(
  '/vehicle',
  protect,
  uploadLimiter,
  vehiclePhotoUpload,
  uploadController.uploadVehiclePhotos,
);

export { uploadRoutes };
