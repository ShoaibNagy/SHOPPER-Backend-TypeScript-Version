import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { Order } from '../../../src/modules/orders/order.model';
import { UserRole } from '../../../src/modules/auth/auth.types';
import { OrderStatus } from '../../../src/modules/orders/order.types';
import { authLimiter } from '../../../src/shared/middleware/rateLimiter';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/orders/order.model');
jest.mock('../../../src/shared/events/eventBus', () => ({
  eventBus: { emit: jest.fn() },
}));
jest.mock('../../../src/config/env', () => ({
  env: {
    node: { env: 'test', isDev: false, isProd: false, port: 4000 },
    jwt: { secret: 'test-secret-32-chars-minimum-len', expiresIn: '7d' },
    bcrypt: { saltRounds: 10 },
    upload: { dir: 'upload/images', maxFileSizeMb: 5 },
    redis: { url: '' },
    stripe: { secretKey: 'sk_test_mock', webhookSecret: 'whsec_mock' },
  },
}));

jest.mock('../../../src/config/stripe', () => ({
  stripe: {
    getClient: jest.fn().mockReturnValue({
      paymentIntents: { create: jest.fn() },
      refunds:        { create: jest.fn() },
      webhooks:       { constructEvent: jest.fn() },
    }),
  },
}));

import { stripe as stripeConfig } from '../../../src/config/stripe';

const getMockStripe = () => stripeConfig.getClient() as unknown as {
  paymentIntents: { create: jest.Mock };
  refunds:        { create: jest.Mock };
  webhooks:       { constructEvent: jest.Mock };
};

const app = createApp();

// ── Token helpers ─────────────────────────────────────────────────────────────
const SECRET   = 'test-secret-32-chars-minimum-len';
const USER_ID  = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ADMIN_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const userToken  = jwt.sign({ id: USER_ID,  email: 'user@example.com',  role: UserRole.USER  }, SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ id: ADMIN_ID, email: 'admin@example.com', role: UserRole.ADMIN }, SECRET, { expiresIn: '1h' });

// ── Fixtures ──────────────────────────────────────────────────────────────────
const orderId = new mongoose.Types.ObjectId().toString();

const makeMockOrder = (
  status = OrderStatus.PENDING,
  ownerId = USER_ID,
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
describe('Payment routes', () => {

  beforeEach(async () => {
    jest.clearAllMocks();
    await authLimiter.resetKey('::ffff:127.0.0.1');
  });

  // ── POST /api/payments/create-intent ─────────────────────────────────────────
  describe('POST /api/payments/create-intent', () => {
    it('returns 201 with clientSecret for a pending order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder());
      getMockStripe().paymentIntents.create.mockResolvedValue({
        id:            'pi_test_123',
        client_secret: 'pi_test_123_secret',
        amount:        10000,
        currency:      'usd',
      });

      const res = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId });

      expect(res.status).toBe(201);
      expect(res.body.data.clientSecret).toBe('pi_test_123_secret');
      expect(res.body.data.amount).toBe(10000);
    });

    it('returns 422 when order is not PENDING', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(
        makeMockOrder(OrderStatus.CONFIRMED),
      );

      const res = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId });

      expect(res.status).toBe(422);
    });

    it('returns 422 when orderId is missing', async () => {
      const res = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(422);
    });

    it('returns 422 for a malformed orderId', async () => {
      const res = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: 'not-an-id' });

      expect(res.status).toBe(422);
    });

    it('returns 403 when user does not own the order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(
        makeMockOrder(OrderStatus.PENDING, ADMIN_ID),
      );

      const res = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId });

      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post('/api/payments/create-intent')
        .send({ orderId });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/payments/refund ─────────────────────────────────────────────────
  describe('POST /api/payments/refund', () => {
    it('returns 200 for an admin refunding any delivered order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(
        makeMockOrder(OrderStatus.DELIVERED, USER_ID, 'pi_test_123'),
      );
      getMockStripe().refunds.create.mockResolvedValue({
        id:     're_test_123',
        amount: 10000,
        status: 'succeeded',
      });

      const res = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderId });

      expect(res.status).toBe(200);
      expect(res.body.data.refundId).toBe('re_test_123');
    });

    it('returns 200 for a user refunding their own delivered order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(
        makeMockOrder(OrderStatus.DELIVERED, USER_ID, 'pi_test_123'),
      );
      getMockStripe().refunds.create.mockResolvedValue({
        id:     're_test_456',
        amount: 10000,
        status: 'succeeded',
      });

      const res = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId });

      expect(res.status).toBe(200);
    });

    it('returns 422 for a non-delivered order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(
        makeMockOrder(OrderStatus.SHIPPED, USER_ID, 'pi_test_123'),
      );

      const res = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId });

      expect(res.status).toBe(422);
    });

    it('returns 422 when orderId is missing', async () => {
      const res = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(422);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post('/api/payments/refund')
        .send({ orderId });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/payments/webhook ────────────────────────────────────────────────
  describe('POST /api/payments/webhook', () => {
    it('returns 200 for a valid payment_intent.succeeded event', async () => {
      const mockOrder = makeMockOrder(OrderStatus.PENDING);
      getMockStripe().webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_123', amount: 10000, last_payment_error: null } },
      });
      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'valid_sig')
        .set('Content-Type', 'application/json')
        .send(Buffer.from('{}'));

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it('returns 400 when stripe-signature header is missing', async () => {
      const res = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(Buffer.from('{}'));

      expect(res.status).toBe(400);
    });

    it('returns 400 when signature verification fails', async () => {
      getMockStripe().webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching');
      });

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'bad_sig')
        .set('Content-Type', 'application/json')
        .send(Buffer.from('{}'));

      expect(res.status).toBe(400);
    });
  });
});