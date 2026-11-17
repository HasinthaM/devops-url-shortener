import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred. Please try again later.';
  let details: unknown = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      errorCode = 'DUPLICATE_RESOURCE';
      message = 'A resource with this identifier already exists.';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      errorCode = 'RESOURCE_NOT_FOUND';
      message = 'The requested database record was not found.';
    } else {
      statusCode = 400;
      errorCode = 'DATABASE_REQUEST_ERROR';
      message = 'Database operation failed.';
    }
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON_BODY';
    message = 'Malformed JSON payload provided in request body.';
  }

  // Log error with request correlation ID
  if (statusCode >= 500) {
    logger.error(
      {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        err,
      },
      'Unhandled Server Error',
    );
  } else {
    logger.warn(
      {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode,
        errorCode,
        message,
      },
      'Client Request Error',
    );
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
