import { Router } from 'express';

import * as vehicleCatalogController from '@/controllers/vehicleCatalogController';

const metaRoutes = Router();

/**
 * @openapi
 * /meta/vehicle-types:
 *   get:
 *     tags: [Meta]
 *     summary: Get vehicle type enum values
 *     responses: { 200: { description: List of vehicle types } }
 */

metaRoutes.get('/vehicle-types', vehicleCatalogController.getVehicleTypes);

export { metaRoutes };
