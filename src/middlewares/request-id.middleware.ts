import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.headers['x-request-id'];
  // Only accept well-formed client IDs (prevents log injection / header abuse); otherwise generate one.
  const requestId =
    typeof existingId === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(existingId)
      ? existingId
      : randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
