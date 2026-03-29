import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/utils/validators';
import {
  createPaymentIntentHandler,
  processRefundHandler,
  webhookHandler,
} from './payment.controller';

const router = Router();

// ── Webhook route — registered FIRST with raw body parser ────────────────────
// express.json() in app.ts would parse the body into an object, destroying the
// raw Buffer that Stripe needs for HMAC signature verification. This route
// intercepts the request before the global JSON middleware by registering its
// own express.raw() parser specifically for this path.

router.post(
  '/webhook',
  (req: Request, res: Response, next: NextFunction): void => {
    // express.raw() parses the body as a Buffer — required by stripe.webhooks.constructEvent
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expressRaw = require('express').raw({ type: 'application/json' }) as (
      req: Request, res: Response, next: NextFunction
    ) => void;
    expressRaw(req, res, next);
  },
  webhookHandler,
);

// ── Authenticated routes ──────────────────────────────────────────────────────
router.use(authenticate);

/**
 * @route  POST /api/payments/create-intent
 * @access Private
 * @desc   Create a Stripe PaymentIntent for a pending order.
 *         Returns a clientSecret the frontend uses to confirm the payment.
 */
router.post(
  '/create-intent',
  [
    body('orderId')
      .notEmpty().withMessage('orderId is required')
      .isMongoId().withMessage('orderId must be a valid MongoDB ObjectId'),
  ],
  validate,
  createPaymentIntentHandler,
);

/**
 * @route  POST /api/payments/refund
 * @access Private (own delivered orders) / Admin (any delivered order)
 * @desc   Issue a full refund for a delivered order via Stripe.
 */
router.post(
  '/refund',
  [
    body('orderId')
      .notEmpty().withMessage('orderId is required')
      .isMongoId().withMessage('orderId must be a valid MongoDB ObjectId'),
    body('reason').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  processRefundHandler,
);

export { router as paymentRouter };