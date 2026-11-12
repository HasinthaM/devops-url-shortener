import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.headers['x-request-id'];
  const requestId = typeof existingId === 'string' && existingId.trim() !== '' ? existingId : randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};

