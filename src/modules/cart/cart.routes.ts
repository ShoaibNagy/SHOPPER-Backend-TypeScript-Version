import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/utils/validators';
import {
  getCartHandler,
  addToCartHandler,
  removeFromCartHandler,
  updateCartItemHandler,
  clearCartHandler,
} from './cart.controller';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// ── Validators ────────────────────────────────────────────────────────────────

const productIdValidator = body('productId')
  .trim()
  .notEmpty()
  .withMessage('productId is required')
  .isMongoId()
  .withMessage('productId must be a valid MongoDB ObjectId');

const quantityValidator = body('quantity')
  .optional()
  .isInt({ min: 1 })
  .withMessage('quantity must be a positive integer');

const removeQuantityValidator = body('quantity')
  .optional()
  .custom((val: unknown) => {
    const n = Number(val);
    if (n === -1 || (Number.isInteger(n) && n >= 1)) return true;
    throw new Error('quantity must be a positive integer or -1 to remove entirely');
  });

const absoluteQuantityValidator = body('quantity')
  .isInt({ min: 0 })
  .withMessage('quantity must be a non-negative integer');

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * @route  GET /api/cart
 * @access Private
 * @desc   Get the authenticated user's fully populated cart
 */
router.get('/', getCartHandler);

/**
 * @route  POST /api/cart/items
 * @access Private
 * @desc   Add a product to the cart (increments if already present)
 */
router.post(
  '/items',
  [productIdValidator, quantityValidator],
  validate,
  addToCartHandler,
);

/**
 * @route  PATCH /api/cart/items
 * @access Private
 * @desc   Set a product's cart quantity to an absolute value (0 removes it)
 */
router.patch(
  '/items',
  [productIdValidator, absoluteQuantityValidator],
  validate,
  updateCartItemHandler,
);

/**
 * @route  DELETE /api/cart/items
 * @access Private
 * @desc   Decrement or fully remove a product from the cart
 */
router.delete(
  '/items',
  [productIdValidator, removeQuantityValidator],
  validate,
  removeFromCartHandler,
);

/**
 * @route  DELETE /api/cart
 * @access Private
 * @desc   Clear all items from the cart
 */
router.delete('/', clearCartHandler);

export { router as cartRouter };