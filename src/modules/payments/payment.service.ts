import Stripe from 'stripe';
import mongoose from 'mongoose';
import { stripe as stripeConfig } from '../../config/stripe';
import { env } from '../../config/env';
import { Order } from '../orders/order.model';
import { AppError } from '../../shared/middleware/errorHandler';
import { eventBus } from '../../shared/events/eventBus';
import { logger } from '../../shared/middleware/logger';
import { OrderStatus } from '../orders/order.types';
import {
  CreatePaymentIntentDTO,
  PaymentIntentResponse,
  RefundDTO,
  RefundResponse,
} from './payment.types';

// ── Service operations ────────────────────────────────────────────────────────

const createPaymentIntent = async (
  userId: string,
  dto: CreatePaymentIntentDTO,
): Promise<PaymentIntentResponse> => {
  if (!mongoose.Types.ObjectId.isValid(dto.orderId)) {
    throw new AppError('Invalid order ID.', 400);
  }

  const order = await Order.findById(dto.orderId);
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  // Ownership check — only the order's owner can initiate payment
  if (order.userId.toString() !== userId) {
    throw new AppError('You do not have permission to pay for this order.', 403);
  }

  if (order.status !== OrderStatus.PENDING) {
    throw new AppError(
      `Payment cannot be initiated for an order with status '${order.status}'.`,
      422,
    );
  }

  // Stripe amounts are in the smallest currency unit — multiply by 100 for cents
  const amountInCents = Math.round(order.total * 100);

  const stripeClient = stripeConfig.getClient();
  const paymentIntent = await stripeClient.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    metadata: {
      orderId: order._id.toString(),
      userId,
    },
  });

  // Persist the intent ID so the webhook can look up the order
  order.paymentIntentId = paymentIntent.id;
  await order.save();

  logger.info(`PaymentIntent created: ${paymentIntent.id} for order ${order._id.toString()}`);

  if (!paymentIntent.client_secret) {
    throw new AppError('Failed to create payment intent.', 500);
  }

  return {
    clientSecret:    paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount:          amountInCents,
    currency:        paymentIntent.currency,
  };
};

const processRefund = async (
  userId: string,
  dto: RefundDTO,
  isAdmin: boolean,
): Promise<RefundResponse> => {
  if (!mongoose.Types.ObjectId.isValid(dto.orderId)) {
    throw new AppError('Invalid order ID.', 400);
  }

  const order = await Order.findById(dto.orderId);
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  if (!isAdmin && order.userId.toString() !== userId) {
    throw new AppError('You do not have permission to refund this order.', 403);
  }

  if (order.status !== OrderStatus.DELIVERED) {
    throw new AppError(
      `Refunds can only be issued for delivered orders. Current status: '${order.status}'.`,
      422,
    );
  }

  if (!order.paymentIntentId) {
    throw new AppError('No payment found for this order.', 422);
  }

  const stripeClient = stripeConfig.getClient();
  const refund = await stripeClient.refunds.create({
    payment_intent: order.paymentIntentId,
    reason:         'requested_by_customer',
    metadata: {
      orderId: order._id.toString(),
      userId,
    },
  });

  // Update order status to refunded
  order.status = OrderStatus.REFUNDED;
  await order.save();

  eventBus.emit('payment.succeeded', {
    orderId: order._id.toString(),
    amount:  order.total,
  });

  logger.info(`Refund issued: ${refund.id} for order ${order._id.toString()}`);

  return {
    refundId: refund.id,
    amount:   refund.amount,
    status:   refund.status ?? 'succeeded',
  };
};

// ── Webhook handler ───────────────────────────────────────────────────────────
// Called by the controller with the raw request body (Buffer) and the
// Stripe-Signature header. Verifies the event signature before processing.

const handleWebhook = async (
  rawBody: Buffer,
  signature: string,
): Promise<void> => {
  const stripeClient = stripeConfig.getClient();
  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(
      rawBody,
      signature,
      env.stripe.webhookSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(`Webhook signature verification failed: ${message}`);
    throw new AppError(`Webhook signature verification failed: ${message}`, 400);
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  switch (event.type) {
    case 'payment_intent.succeeded':
      await onPaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payment_intent.payment_failed':
      await onPaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case 'charge.refunded':
      // Handled via processRefund — no additional action needed here
      logger.info('charge.refunded event received — handled by processRefund.');
      break;

    default:
      logger.info(`Unhandled Stripe event type: ${event.type}`);
  }
};

// ── Webhook event processors ──────────────────────────────────────────────────

const onPaymentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> => {
  const order = await Order.findOne({ paymentIntentId: paymentIntent.id });
  if (!order) {
    logger.warn(`payment_intent.succeeded: no order found for intent ${paymentIntent.id}`);
    return;
  }

  if (order.status !== OrderStatus.PENDING) {
    // Idempotency guard — webhook may be delivered more than once
    logger.info(`payment_intent.succeeded: order ${order._id.toString()} already in status '${order.status}', skipping.`);
    return;
  }

  order.status = OrderStatus.CONFIRMED;
  await order.save();

  eventBus.emit('payment.succeeded', {
    orderId: order._id.toString(),
    amount:  paymentIntent.amount / 100,
  });

  logger.info(`Order ${order._id.toString()} confirmed via webhook.`);
};

const onPaymentFailed = async (
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> => {
  const order = await Order.findOne({ paymentIntentId: paymentIntent.id });
  if (!order) {
    logger.warn(`payment_intent.payment_failed: no order found for intent ${paymentIntent.id}`);
    return;
  }

  const reason = paymentIntent.last_payment_error?.message ?? 'Payment failed';

  eventBus.emit('payment.failed', {
    orderId: order._id.toString(),
    reason,
  });

  logger.warn(`Payment failed for order ${order._id.toString()}: ${reason}`);
};

export const paymentService = {
  createPaymentIntent,
  processRefund,
  handleWebhook,
};