import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

// Custom error class for API errors
export class ApiError extends Error {
  statusCode: number;
  
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
  
  static badRequest(message: string): ApiError {
    return new ApiError(400, message);
  }
  
  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }
  
  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }
  
  static notFound(message: string = 'Not found'): ApiError {
    return new ApiError(404, message);
  }
  
  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }
  
  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(500, message);
  }
}

// Global error handler
export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
  console.error('Error:', err);
  
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }
  
  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'A record with this value already exists',
      });
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Record not found',
      });
      return;
    }
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
}

// Async handler wrapper to catch errors
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
