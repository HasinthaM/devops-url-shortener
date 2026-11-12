import {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  GoneError,
  ValidationError,
} from '../../src/utils/errors';

describe('Custom Error Classes', () => {
  it('AppError should set defaults correctly', () => {
    const err = new AppError('Server error');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err.isOperational).toBe(true);
  });

  it('NotFoundError should have 404 status', () => {
    const err = new NotFoundError('Missing item');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('BadRequestError should have 400 status', () => {
    const err = new BadRequestError('Bad input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('UnauthorizedError should have 401 status', () => {
    const err = new UnauthorizedError('Unauthorized');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ConflictError should have 409 status', () => {
    const err = new ConflictError('Duplicate');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('GoneError should have 410 status', () => {
    const err = new GoneError('Expired');
    expect(err.statusCode).toBe(410);
    expect(err.code).toBe('RESOURCE_GONE');
  });

  it('ValidationError should format details correctly', () => {
    const details = [{ field: 'email', message: 'invalid' }];
    const err = new ValidationError('Validation failed', details);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
  });
});

