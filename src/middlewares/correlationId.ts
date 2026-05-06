import crypto from 'crypto';

import { Request, Response, NextFunction } from 'express';

import { correlationStore } from '@/utils/logger';

function correlationId(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  correlationStore.run({ requestId }, () => {
    next();
  });
}

export { correlationId };
