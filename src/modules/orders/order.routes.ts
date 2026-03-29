import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate, authorize } from '../auth/auth.middleware';
import { UserRole } from '../auth/auth.types';
import { mongoIdParam, paginationQueryValidators, validate } from '../../shared/utils/validators';
import { OrderStatus } from './order.types';
import {
  placeOrderHandler,
  getMyOrdersHandler,
  getOrderByIdHandler,
  getAllOrdersHandler,
  updateOrderStatusHandler,
  cancelOrderHandler,
} from './order.controller';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// ── Validators ────────────────────────────────────────────────────────────────

const shippingAddressValidators = [
  body('shippingAddress').notEmpty().withMessage('shippingAddress is required'),
  body('shippingAddress.fullName').trim().notEmpty().withMessage('Full name is required'),
  body('shippingAddress.line1').trim().notEmpty().withMessage('Address line 1 is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
  body('shippingAddress.postalCode').trim().notEmpty().withMessage('Postal code is required'),
  body('shippingAddress.country').trim().notEmpty().withMessage('Country is required'),
];

const statusQueryValidator = query('status')
  .optional()
  .isIn(Object.values(OrderStatus))
  .withMessage(`status must be one of: ${Object.values(OrderStatus).join(', ')}`);

const statusBodyValidator = body('status')
  .notEmpty()
  .withMessage('status is required')
  .isIn(Object.values(OrderStatus))
  .withMessage(`status must be one of: ${Object.values(OrderStatus).join(', ')}`);

// ── User routes ───────────────────────────────────────────────────────────────

/**
 * @route  POST /api/orders
 * @access Private
 * @desc   Place an order from the authenticated user's current cart
 */
router.post(
  '/',
  shippingAddressValidators,
  validate,
  placeOrderHandler,
);

/**
 * @route  GET /api/orders/my
 * @access Private
 * @desc   Get the authenticated user's order history (paginated)
 */
router.get(
  '/my',
  paginationQueryValidators,
  statusQueryValidator,
  validate,
  getMyOrdersHandler,
);

/**
 * @route  GET /api/orders/:id
 * @access Private (own orders) / Admin (any order)
 * @desc   Get a single order by ID
 */
router.get(
  '/:id',
  mongoIdParam('id'),
  validate,
  getOrderByIdHandler,
);

/**
 * @route  DELETE /api/orders/:id/cancel
 * @access Private (own pending/confirmed orders) / Admin (any cancellable order)
 * @desc   Cancel an order
 */
router.delete(
  '/:id/cancel',
  mongoIdParam('id'),
  validate,
  cancelOrderHandler,
);

// ── Admin routes ──────────────────────────────────────────────────────────────

/**
 * @route  GET /api/orders
 * @access Admin
 * @desc   Get all orders with optional filters (paginated)
 */
router.get(
  '/',
  authorize(UserRole.ADMIN),
  paginationQueryValidators,
  statusQueryValidator,
  query('userId').optional().isMongoId().withMessage('userId must be a valid MongoDB ObjectId'),
  validate,
  getAllOrdersHandler,
);

/**
 * @route  PATCH /api/orders/:id/status
 * @access Admin
 * @desc   Update order status (enforces state machine transitions)
 */
router.patch(
  '/:id/status',
  authorize(UserRole.ADMIN),
  mongoIdParam('id'),
  statusBodyValidator,
  validate,
  updateOrderStatusHandler,
);

export { router as orderRouter };