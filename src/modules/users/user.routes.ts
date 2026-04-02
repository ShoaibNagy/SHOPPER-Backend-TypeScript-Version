import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate, authorize } from '../auth/auth.middleware';
import { UserRole } from '../auth/auth.types';
import { apiLimiter } from '../../shared/middleware/rateLimiter';
import {
  mongoIdParam,
  paginationQueryValidators,
  roleQueryValidator,
  validate,
} from '../../shared/utils/validators';
import {
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  deactivateAccountHandler,
  getAllUsersHandler,
  getUserByIdHandler,
  adminUpdateUserHandler,
  adminDeleteUserHandler,
} from './user.controller';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ── Self-service routes (/api/users/me) ───────────────────────────────────────
// These must be registered BEFORE /:id to avoid "me" being treated as a param

/**
 * @route  GET /api/users/me
 * @access Private
 */
router.get('/me', getProfileHandler);

/**
 * @route  PATCH /api/users/me
 * @access Private
 */
router.patch(
  '/me',
  [
    body('username')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Username cannot be empty')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
  ],
  validate,
  updateProfileHandler,
);

/**
 * @route  PATCH /api/users/me/password
 * @access Private
 */
router.patch(
  '/me/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain uppercase, lowercase, and a number')
      .custom((newPw: string, { req }) => {
        if (newPw === (req.body as Record<string, string>)['currentPassword']) {
          throw new Error('New password must differ from current password');
        }
        return true;
      }),
  ],
  validate,
  changePasswordHandler,
);

/**
 * @route  DELETE /api/users/me
 * @access Private
 */
router.delete('/me', deactivateAccountHandler);

// ── Admin-only routes ─────────────────────────────────────────────────────────

/**
 * @route  GET /api/users
 * @access Admin
 */
router.get(
  '/',
  authorize(UserRole.ADMIN),
  apiLimiter,
  paginationQueryValidators,
  roleQueryValidator,
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  validate,
  getAllUsersHandler,
);

/**
 * @route  GET /api/users/:id
 * @access Admin
 */
router.get(
  '/:id',
  authorize(UserRole.ADMIN),
  mongoIdParam('id'),
  validate,
  getUserByIdHandler,
);

/**
 * @route  PATCH /api/users/:id
 * @access Admin
 */
router.patch(
  '/:id',
  authorize(UserRole.ADMIN),
  mongoIdParam('id'),
  [
    body('username').optional().trim().notEmpty().isLength({ min: 3, max: 30 }),
    body('email').optional().trim().isEmail().normalizeEmail(),
    body('role')
      .optional()
      .isIn(Object.values(UserRole))
      .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  validate,
  adminUpdateUserHandler,
);

/**
 * @route  DELETE /api/users/:id
 * @access Admin
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  mongoIdParam('id'),
  validate,
  adminDeleteUserHandler,
);

export { router as userRouter };