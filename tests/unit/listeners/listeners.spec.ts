import mongoose from 'mongoose';
import { registerUserListeners } from '../../../src/shared/events/listeners/user.listener';
import { registerOrderListeners } from '../../../src/shared/events/listeners/order.listener';
import { registerPaymentListeners } from '../../../src/shared/events/listeners/payment.listener';
import { eventBus } from '../../../src/shared/events/eventBus';
import { sendEmail } from '../../../src/shared/utils/emailSender';
import { User } from '../../../src/modules/users/user.model';
import { Order } from '../../../src/modules/orders/order.model';
import { OrderStatus } from '../../../src/modules/orders/order.types';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/modules/orders/order.model');
jest.mock('../../../src/shared/utils/emailSender', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  emailTemplates: {
    welcomeEmail: (username: string) => ({
      to:      '',
      subject: 'Welcome to Shopper!',
      html:    `<h1>Welcome, ${username}!</h1>`,
      text:    `Welcome, ${username}!`,
    }),
    orderConfirmation: (username: string, orderId: string) => ({
      to:      '',
      subject: `Order ${orderId} confirmed`,
      html:    `<p>Hi ${username}, order ${orderId} confirmed.</p>`,
      text:    `Order ${orderId} confirmed.`,
    }),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const userId  = new mongoose.Types.ObjectId().toString();
const orderId = new mongoose.Types.ObjectId().toString();

const mockUser = {
  _id:      new mongoose.Types.ObjectId(userId),
  email:    'user@example.com',
  username: 'testuser',
};

const mockOrder = {
  _id:    new mongoose.Types.ObjectId(orderId),
  userId: new mongoose.Types.ObjectId(userId),
  total:  99.99,
  status: OrderStatus.PENDING,
  items: [
    { name: 'Test Jacket', quantity: 2, price: 49.99, subtotal: 99.98 },
  ],
  shippingAddress: {
    fullName: 'Jane Doe',
    city:     'Cairo',
    country:  'Egypt',
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('EventBus listeners', () => {

  // Register all listeners once before the suite
  beforeAll(() => {
    registerUserListeners();
    registerOrderListeners();
    registerPaymentListeners();
  });

  beforeEach(() => jest.clearAllMocks());

  // ── user.registered ──────────────────────────────────────────────────────────
  describe('user.registered', () => {
    it('sends a welcome email when a user registers', async () => {
      eventBus.emit('user.registered', {
        userId,
        email:    'user@example.com',
        username: 'testuser',
      });

      // Listeners are async — wait for the microtask queue to flush
      await new Promise(setImmediate);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to:      'user@example.com',
          subject: 'Welcome to Shopper!',
        }),
      );
    });

    it('does not throw when email sending fails', async () => {
      (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('SMTP error'));

      expect(() =>
        eventBus.emit('user.registered', {
          userId,
          email:    'user@example.com',
          username: 'testuser',
        }),
      ).not.toThrow();

      await new Promise(setImmediate);
    });
  });

  // ── user.passwordChanged ─────────────────────────────────────────────────────
  describe('user.passwordChanged', () => {
    it('sends a security alert email when password is changed', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      eventBus.emit('user.passwordChanged', { userId });

      await new Promise(setImmediate);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to:      'user@example.com',
          subject: 'Your Shopper password was changed',
        }),
      );
    });

    it('skips email silently when user is not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      eventBus.emit('user.passwordChanged', { userId });

      await new Promise(setImmediate);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // ── order.placed ──────────────────────────────────────────────────────────────
  describe('order.placed', () => {
    it('sends an order receipt email when an order is placed', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      eventBus.emit('order.placed', { orderId, userId, total: 99.99 });

      await new Promise(setImmediate);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to:      'user@example.com',
          subject: `Order ${orderId} received — thank you!`,
        }),
      );
    });

    it('skips email silently when order is not found', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      eventBus.emit('order.placed', { orderId, userId, total: 99.99 });

      await new Promise(setImmediate);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('skips email silently when user is not found', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (User.findById as jest.Mock).mockResolvedValue(null);

      eventBus.emit('order.placed', { orderId, userId, total: 99.99 });

      await new Promise(setImmediate);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // ── order.statusChanged ───────────────────────────────────────────────────────
  describe('order.statusChanged', () => {
    it('sends a status update email for each status transition', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      eventBus.emit('order.statusChanged', {
        orderId,
        status: OrderStatus.SHIPPED,
      });

      await new Promise(setImmediate);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to:      'user@example.com',
          subject: `Your order is on its way to you`,
        }),
      );
    });

    it('skips email silently when order is not found', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      eventBus.emit('order.statusChanged', {
        orderId,
        status: OrderStatus.CONFIRMED,
      });

      await new Promise(setImmediate);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // ── payment.succeeded ─────────────────────────────────────────────────────────
  describe('payment.succeeded', () => {
    it('sends a payment confirmation email on success', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      eventBus.emit('payment.succeeded', { orderId, amount: 99.99 });

      await new Promise(setImmediate);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to:      'user@example.com',
          subject: `Payment confirmed — Order #${orderId}`,
        }),
      );
    });

    it('skips email silently when order is not found', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      eventBus.emit('payment.succeeded', { orderId, amount: 99.99 });

      await new Promise(setImmediate);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // ── payment.failed ────────────────────────────────────────────────────────────
  describe('payment.failed', () => {
    it('sends a payment failure email with the reason', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      eventBus.emit('payment.failed', { orderId, reason: 'Card declined' });

      await new Promise(setImmediate);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to:      'user@example.com',
          subject: `Payment failed — Order #${orderId}`,
        }),
      );
    });

    it('skips email silently when order is not found', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      eventBus.emit('payment.failed', { orderId, reason: 'Card declined' });

      await new Promise(setImmediate);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('does not throw when email sending fails', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('SMTP timeout'));

      expect(() =>
        eventBus.emit('payment.failed', { orderId, reason: 'Card declined' }),
      ).not.toThrow();

      await new Promise(setImmediate);
    });
  });
});