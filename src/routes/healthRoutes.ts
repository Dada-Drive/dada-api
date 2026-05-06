import { Router, Request, Response } from 'express';

import { pingRedis } from '@/config/redis';
import { sequelize } from '@/models/index';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check
 *     description: Returns the current health status of the service including database and Redis connectivity.
 *     responses:
 *       200:
 *         description: Service is healthy or degraded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, degraded]
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: '2026-05-06T12:00:00.000Z'
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 86400
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       enum: [ok, error]
 *                     redis:
 *                       type: string
 *                       enum: [ok, error]
 */
async function checkDatabase(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
}

router.get('/health', async (_req: Request, res: Response) => {
  const [dbOk, redisOk] = await Promise.all([checkDatabase(), pingRedis()]);

  const status = dbOk && redisOk ? 'ok' : 'degraded';

  res.status(200).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
    },
  });
});

export { router as healthRoutes };
