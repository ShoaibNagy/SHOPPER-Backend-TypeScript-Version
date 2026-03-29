import mongoose from 'mongoose';
import { paymentService } from '../../../src/modules/payments/payment.service';
import { Order } from '../../../src/modules/orders/order.model';
import { AppError } from '../../../src/shared/middleware/errorHandler';
import { OrderStatus } from '../../../src/modules/orders/order.types';
import { eventBus } from '../../../src/shared/events/eventBus';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/orders/order.model');
jest.mock('../../../src/shared/events/eventBus', () => ({
  eventBus: { emit: jest.fn() },
}));
jest.mock('../../../src/config/env', () => ({
  env: {
    stripe: { secretKey: 'sk_test_mock', webhookSecret: 'whsec_mock' },
  },
}));

// Mock Stripe client — functions defined inside the factory to avoid
// the jest.mock() hoisting / const TDZ initialisation error
jest.mock('../../../src/config/stripe', () => ({
  stripe: {
    getClient: jest.fn().mockReturnValue({
      paymentIntents: { create: jest.fn() },
      refunds:        { create: jest.fn() },
      webhooks:       { constructEvent: jest.fn() },
    }),
  },
}));

// Grab live references to the mock functions after the factory has run
import { stripe as stripeConfig } from '../../../src/config/stripe';

const getMockStripe = () => stripeConfig.getClient() as unknown as {
  paymentIntents: { create: jest.Mock };
  refunds:        { create: jest.Mock };
  webhooks:       { constructEvent: jest.Mock };
};

// ── Fixtures ──────────────────────────────────────────────────────────────────
const userId  = new mongoose.Types.ObjectId().toString();
const orderId = new mongoose.Types.ObjectId().toString();

const makeMockOrder = (
  status = OrderStatus.PENDING,
  ownerId = userId,
  paymentIntentId?: string,
) => ({
  _id:             new mongoose.Types.ObjectId(orderId),
  userId:          new mongoose.Types.ObjectId(ownerId),
  status,
  total:           100,
  paymentIntentId,
  save:            jest.fn().mockResolvedValue(undefined),
  toResponseObject: jest.fn(),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('paymentService', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── createPaymentIntent ───────────────────────────────────────────────────────
  describe('createPaymentIntent', () => {
    it('creates a PaymentIntent and persists the intent ID on the order', async () => {
      const mockOrder = makeMockOrder();
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      getMockStripe().paymentIntents.create.mockResolvedValue({
        id:            'pi_test_123',
        client_secret: 'pi_test_123_secret',
        amount:        10000,
        currency:      'usd',
      });

      const result = await paymentService.createPaymentIntent(userId, { orderId });

      expect(result.paymentIntentId).toBe('pi_test_123');
      expect(result.clientSecret).toBe('pi_test_123_secret');
      expect(result.amount).toBe(10000);
      expect(mockOrder.paymentIntentId).toBe('pi_test_123');
      expect(mockOrder.save).toHaveBeenCalledTimes(1);
      expect(getMockStripe().paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10000, currency: 'usd' }),
      );
    });

    it('throws 403 when user does not own the order', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.PENDING, otherUserId));

      await expect(
        paymentService.createPaymentIntent(userId, { orderId }),
      ).rejects.toThrow(new AppError('You do not have permission to pay for this order.', 403));
    });

    it('throws 422 when order is not PENDING', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.CONFIRMED));

      await expect(
        paymentService.createPaymentIntent(userId, { orderId }),
      ).rejects.toThrow(new AppError(`Payment cannot be initiated for an order with status 'confirmed'.`, 422));
    });

    it('throws 404 when order does not exist', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        paymentService.createPaymentIntent(userId, { orderId }),
      ).rejects.toThrow(new AppError('Order not found.', 404));
    });

    it('throws 400 for a malformed orderId', async () => {
      await expect(
        paymentService.createPaymentIntent(userId, { orderId: 'bad-id' }),
      ).rejects.toThrow(new AppError('Invalid order ID.', 400));
    });
  });

  // ── processRefund ─────────────────────────────────────────────────────────────
  describe('processRefund', () => {
    it('issues a refund and updates order status to REFUNDED', async () => {
      const mockOrder = makeMockOrder(OrderStatus.DELIVERED, userId, 'pi_test_123');
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      getMockStripe().refunds.create.mockResolvedValue({
        id:     're_test_123',
        amount: 10000,
        status: 'succeeded',
      });

      const result = await paymentService.processRefund(userId, { orderId }, false);

      expect(result.refundId).toBe('re_test_123');
      expect(mockOrder.status).toBe(OrderStatus.REFUNDED);
      expect(mockOrder.save).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'payment.succeeded',
        expect.objectContaining({ orderId }),
      );
    });

    it('throws 422 when order is not DELIVERED', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(
        makeMockOrder(OrderStatus.CONFIRMED, userId, 'pi_test_123'),
      );

      await expect(
        paymentService.processRefund(userId, { orderId }, false),
      ).rejects.toThrow(new AppError(`Refunds can only be issued for delivered orders. Current status: 'confirmed'.`, 422));
    });

    it('throws 422 when no paymentIntentId exists on the order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(
        makeMockOrder(OrderStatus.DELIVERED, userId, undefined),
      );

      await expect(
        paymentService.processRefund(userId, { orderId }, false),
      ).rejects.toThrow(new AppError('No payment found for this order.', 422));
    });

    it('throws 403 when non-owner tries to refund', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Order.findById as jest.Mock).mockResolvedValue(
        makeMockOrder(OrderStatus.DELIVERED, otherUserId, 'pi_test_123'),
      );

      await expect(
        paymentService.processRefund(userId, { orderId }, false),
      ).rejects.toThrow(new AppError('You do not have permission to refund this order.', 403));
    });

    it('allows admin to refund any delivered order', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      const mockOrder = makeMockOrder(OrderStatus.DELIVERED, otherUserId, 'pi_test_123');
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      getMockStripe().refunds.create.mockResolvedValue({
        id: 're_test_456', amount: 10000, status: 'succeeded',
      });

      const result = await paymentService.processRefund(userId, { orderId }, true);

      expect(result.refundId).toBe('re_test_456');
      expect(mockOrder.status).toBe(OrderStatus.REFUNDED);
    });
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────────
  describe('handleWebhook', () => {
    const rawBody  = Buffer.from('{}');
    const sig      = 'stripe_sig';

    it('confirms a PENDING order on payment_intent.succeeded', async () => {
      const mockOrder = makeMockOrder(OrderStatus.PENDING);
      getMockStripe().webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_123', amount: 10000, last_payment_error: null } },
      });
      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);

      await paymentService.handleWebhook(rawBody, sig);

      expect(mockOrder.status).toBe(OrderStatus.CONFIRMED);
      expect(mockOrder.save).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'payment.succeeded',
        expect.objectContaining({ orderId }),
      );
    });

    it('is idempotent — does not double-confirm an already CONFIRMED order', async () => {
      const mockOrder = makeMockOrder(OrderStatus.CONFIRMED);
      getMockStripe().webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_123', amount: 10000 } },
      });
      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);

      await paymentService.handleWebhook(rawBody, sig);

      expect(mockOrder.save).not.toHaveBeenCalled();
    });

    it('emits payment.failed on payment_intent.payment_failed', async () => {
      const mockOrder = makeMockOrder(OrderStatus.PENDING);
      getMockStripe().webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_test_123', last_payment_error: { message: 'Card declined' } } },
      });
      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);

      await paymentService.handleWebhook(rawBody, sig);

      expect(eventBus.emit).toHaveBeenCalledWith(
        'payment.failed',
        expect.objectContaining({ reason: 'Card declined' }),
      );
    });

    it('throws 400 when the webhook signature is invalid', async () => {
      getMockStripe().webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching');
      });

      await expect(
        paymentService.handleWebhook(rawBody, 'bad_sig'),
      ).rejects.toThrow(new AppError('Webhook signature verification failed: No signatures found matching', 400));
    });
  });
});