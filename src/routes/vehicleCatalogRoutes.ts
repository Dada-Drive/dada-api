import { Router } from 'express';

import * as vehicleCatalogController from '@/controllers/vehicleCatalogController';

const vehicleCatalogRoutes = Router();

/**
 * @openapi
 * /vehicles/makes:
 *   get:
 *     tags: [Vehicles]
 *     summary: Get all vehicle makes
 *     responses: { 200: { description: List of makes } }
 * /vehicles/models/{make}:
 *   get:
 *     tags: [Vehicles]
 *     summary: Get models for a make
 *     parameters:
 *       - in: path
 *         name: make
 *         required: true
 *         schema: { type: string }
 *     responses: { 200: { description: List of models } }
 */

vehicleCatalogRoutes.get('/makes', vehicleCatalogController.getMakes);
vehicleCatalogRoutes.get('/models/:make', vehicleCatalogController.getModelsByMake);

export { vehicleCatalogRoutes };
