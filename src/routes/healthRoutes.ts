import { Router, Request, Response } from 'express';

import { getHealthStatus } from '@/services/healthService';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Full health check
 *     description: Returns health status of all dependencies (database, Redis, Firebase). Returns 503 if any critical dependency is unhealthy.
 *     responses:
 *       200:
 *         description: All dependencies healthy
 *       503:
 *         description: One or more dependencies unhealthy
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const result = await getHealthStatus();
    const statusCode = result.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(result);
  }),
);

/**
 * @openapi
 * /api/v1/health/ready:
 *   get:
 *     tags:
 *       - Health
 *     summary: Readiness probe
 *     description: Returns 200 when the service is ready to accept traffic (all dependencies up). Returns 503 otherwise.
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const result = await getHealthStatus();
    const statusCode = result.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({ status: result.status === 'healthy' ? 'ready' : 'not_ready' });
  }),
);

/**
 * @openapi
 * /api/v1/health/live:
 *   get:
 *     tags:
 *       - Health
 *     summary: Liveness probe
 *     description: Always returns 200 if the process is running. No dependency checks.
 *     responses:
 *       200:
 *         description: Process is alive
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export { router as healthRoutes };
