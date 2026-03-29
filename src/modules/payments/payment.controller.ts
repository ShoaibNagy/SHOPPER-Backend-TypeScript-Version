import { Request, Response } from 'express';
import { paymentService } from './payment.service';
import { asyncHandler, AppError } from '../../shared/middleware/errorHandler';
import { ApiResponse } from '../../shared/types/common.types';
import { UserRole } from '../auth/auth.types';
import {
  CreatePaymentIntentDTO,
  PaymentIntentResponse,
  RefundDTO,
  RefundResponse,
} from './payment.types';

// POST /api/payments/create-intent
export const createPaymentIntentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: CreatePaymentIntentDTO = {
      orderId: req.body.orderId as string,
    };

    const result = await paymentService.createPaymentIntent(req.user!.id, dto);

    const response: ApiResponse<PaymentIntentResponse> = {
      success: true,
      message: 'Payment intent created.',
      data: result,
    };
    res.status(201).json(response);
  },
);

// POST /api/payments/refund
export const processRefundHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: RefundDTO = {
      orderId: req.body.orderId as string,
      reason:  req.body.reason as string | undefined,
    };

    const isAdmin = req.user!.role === UserRole.ADMIN;
    const result = await paymentService.processRefund(req.user!.id, dto, isAdmin);

    const response: ApiResponse<RefundResponse> = {
      success: true,
      message: 'Refund issued successfully.',
      data: result,
    };
    res.status(200).json(response);
  },
);

// POST /api/payments/webhook
// NOTE: This handler must receive the raw request body (Buffer) for Stripe
// signature verification. express.json() must NOT run before this route —
// see the raw body middleware applied in payment.routes.ts.
export const webhookHandler = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'];

  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ success: false, message: 'Missing stripe-signature header.' });
    return;
  }

  try {
    await paymentService.handleWebhook(req.body as Buffer, signature);
    // Stripe requires a 2xx response to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (err) {
    const message = err instanceof AppError ? err.message : 'Webhook processing failed.';
    const status  = err instanceof AppError ? err.statusCode : 500;
    res.status(status).json({ success: false, message });
  }
};