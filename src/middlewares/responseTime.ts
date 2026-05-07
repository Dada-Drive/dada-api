import { Request, Response, NextFunction } from 'express';

import { config } from '@/config/index';
import { logger } from '@/utils/logger';

function responseTime(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const meta = {
      method: req.method,
      route: (req.route?.path as string | undefined) ?? req.path,
      statusCode: res.statusCode,
      responseTime: `${durationMs.toFixed(2)}ms`,
      userId: req.user?.userId,
      component: 'http',
    };

    if (durationMs >= config.performance.slowRouteMs) {
      logger.warn('Slow response detected', meta);
    }
  });

  next();
}

export { responseTime };
