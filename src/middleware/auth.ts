import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import { verifyAccessToken } from '../utils/jwt';

export function authenticate(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'No token provided',
    });
    return;
  }
  
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const payload = verifyAccessToken(token);
  
  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
    return;
  }
  
  req.user = payload;
  next();
}

// Optional auth - attaches user if token present, but doesn't require it
export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}
