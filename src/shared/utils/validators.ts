import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';

// Runs accumulated validation results and throws if any failed
export const validate = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg as string);
    return next(new AppError(messages.join(', '), 422));
  }
  next();
};

// Auth validators
export const signupValidators = [
  body('username').trim().notEmpty().withMessage('Username is required').isLength({ min: 3, max: 30 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
];

export const loginValidators = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// Product validators
export const createProductValidators = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 200 }),
  body('image').trim().notEmpty().withMessage('Product image URL is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('new_price').isFloat({ min: 0 }).withMessage('new_price must be a positive number'),
  body('old_price').isFloat({ min: 0 }).withMessage('old_price must be a positive number'),
];

// Param validators
export const mongoIdParam = (paramName: string) =>
  param(paramName).isMongoId().withMessage(`${paramName} must be a valid MongoDB ObjectId`);

// Query validators
export const paginationQueryValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
];