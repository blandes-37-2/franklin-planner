import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiResponse } from '../types';

// Run validations and check for errors
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        data: errors.array(),
      });
      return;
    }
    
    next();
  };
}

// Time format validator (HH:mm)
export function isValidTimeFormat(value: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(value);
}

// Date format validator (YYYY-MM-DD)
export function isValidDateFormat(value: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;
  
  const date = new Date(value);
  return date instanceof Date && !isNaN(date.getTime());
}

// Day of week validator (0-6 or null)
export function isValidDayOfWeek(value: number | null): boolean {
  if (value === null) return true;
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

// Rating validator (1-5)
export function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

// Hex color validator
export function isValidHexColor(value: string): boolean {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(value);
}
