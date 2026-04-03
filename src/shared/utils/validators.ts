import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { ProductCategory } from '../../modules/products/product.types';
import { OrderStatus } from '../../modules/orders/order.types';
import { UserRole } from '../../modules/auth/auth.types';

// ── Runner ────────────────────────────────────────────────────────────────────
// Collects all express-validator errors and throws a single 422 AppError.

export const validate = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg as string);
    return next(new AppError(messages.join(', '), 422));
  }
  next();
};

// ── Auth validators ───────────────────────────────────────────────────────────

export const signupValidators = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
];

export const loginValidators = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Product validators ────────────────────────────────────────────────────────

const validCategories = Object.values(ProductCategory);

export const createProductValidators = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ max: 200 }).withMessage('Product name cannot exceed 200 characters'),
  body('image')
    .trim()
    .notEmpty().withMessage('Product image URL is required')
    .isURL({ require_tld: false }).withMessage('Product image must be a valid URL'),
  body('category')
    .trim()
    .notEmpty().withMessage('Category is required')
    .isIn(validCategories)
    .withMessage(`Category must be one of: ${validCategories.join(', ')}`),
  body('new_price')
    .isFloat({ min: 0 }).withMessage('new_price must be a non-negative number'),
  body('old_price')
    .isFloat({ min: 0 }).withMessage('old_price must be a non-negative number'),
];

// ── Order validators ──────────────────────────────────────────────────────────

export const orderStatusValidators = [
  body('status')
    .notEmpty().withMessage('status is required')
    .isIn(Object.values(OrderStatus))
    .withMessage(`status must be one of: ${Object.values(OrderStatus).join(', ')}`),
];

// ── Param validators ──────────────────────────────────────────────────────────

export const mongoIdParam = (paramName: string) =>
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} must be a valid MongoDB ObjectId`);

// ── Query validators ──────────────────────────────────────────────────────────

export const paginationQueryValidators = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .trim()
    .notEmpty().withMessage('sortBy cannot be empty'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
];

export const categoryQueryValidator = query('category')
  .optional()
  .isIn(validCategories)
  .withMessage(`category must be one of: ${validCategories.join(', ')}`);

export const roleQueryValidator = query('role')
  .optional()
  .isIn(Object.values(UserRole))
  .withMessage(`role must be one of: ${Object.values(UserRole).join(', ')}`);

export const orderStatusQueryValidator = query('status')
  .optional()
  .isIn(Object.values(OrderStatus))
  .withMessage(`status must be one of: ${Object.values(OrderStatus).join(', ')}`);