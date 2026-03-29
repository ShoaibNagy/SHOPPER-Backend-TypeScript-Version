import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate, authorize, optionalAuthenticate } from '../auth/auth.middleware';
import { UserRole } from '../auth/auth.types';
import { mongoIdParam, paginationQueryValidators, validate } from '../../shared/utils/validators';
import { publicLimiter } from '../../shared/middleware/rateLimiter';
import {
  getReviewsByProductHandler,
  getAverageRatingHandler,
  createReviewHandler,
  deleteReviewHandler,
  getAllReviewsHandler,
} from './review.controller';

const router = Router();

// ── Shared validators ─────────────────────────────────────────────────────────

const ratingQueryValidator = query('rating')
  .optional()
  .isInt({ min: 1, max: 5 })
  .withMessage('rating must be an integer between 1 and 5');

// ── Public routes ─────────────────────────────────────────────────────────────

/**
 * @route  GET /api/reviews/product/:productId
 * @access Public
 * @desc   Get paginated reviews for a product, optionally filtered by rating
 */
router.get(
  '/product/:productId',
  publicLimiter,
  optionalAuthenticate,
  mongoIdParam('productId'),
  paginationQueryValidators,
  ratingQueryValidator,
  validate,
  getReviewsByProductHandler,
);

/**
 * @route  GET /api/reviews/product/:productId/rating
 * @access Public
 * @desc   Get average rating and total review count for a product
 */
router.get(
  '/product/:productId/rating',
  publicLimiter,
  mongoIdParam('productId'),
  validate,
  getAverageRatingHandler,
);

// ── Authenticated routes ──────────────────────────────────────────────────────

/**
 * @route  POST /api/reviews
 * @access Private — must have a delivered order containing the product
 * @desc   Submit a review for a purchased product
 */
router.post(
  '/',
  authenticate,
  [
    body('productId')
      .notEmpty().withMessage('productId is required')
      .isMongoId().withMessage('productId must be a valid MongoDB ObjectId'),
    body('rating')
      .notEmpty().withMessage('rating is required')
      .isInt({ min: 1, max: 5 }).withMessage('rating must be an integer between 1 and 5'),
    body('comment')
      .trim()
      .notEmpty().withMessage('comment is required')
      .isLength({ max: 1000 }).withMessage('comment cannot exceed 1000 characters'),
  ],
  validate,
  createReviewHandler,
);

/**
 * @route  DELETE /api/reviews/:id
 * @access Private (own reviews) / Admin (any review)
 * @desc   Delete a review
 */
router.delete(
  '/:id',
  authenticate,
  mongoIdParam('id'),
  validate,
  deleteReviewHandler,
);

// ── Admin routes ──────────────────────────────────────────────────────────────

/**
 * @route  GET /api/reviews
 * @access Admin
 * @desc   Get all reviews with optional filters (paginated)
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  paginationQueryValidators,
  ratingQueryValidator,
  query('productId').optional().isMongoId().withMessage('productId must be a valid MongoDB ObjectId'),
  query('userId').optional().isMongoId().withMessage('userId must be a valid MongoDB ObjectId'),
  validate,
  getAllReviewsHandler,
);

export { router as reviewRouter };