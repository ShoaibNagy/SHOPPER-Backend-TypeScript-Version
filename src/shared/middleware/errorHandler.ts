import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { ApiResponse } from '../types/common.types';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const isOperational = isAppError ? err.isOperational : false;

  if (!isOperational) {
    logger.error('Unhandled error:', { message: err.message, stack: err.stack });
  }

  const response: ApiResponse = {
    success: false,
    message: isOperational ? err.message : 'An unexpected error occurred',
    ...(process.env['NODE_ENV'] === 'development' && { errors: err.stack }),
  };

  res.status(statusCode).json(response);
};

// Wraps async route handlers to forward errors to errorHandler
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };