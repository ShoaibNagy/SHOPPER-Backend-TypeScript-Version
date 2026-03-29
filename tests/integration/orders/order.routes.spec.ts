import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { Order } from '../../../src/modules/orders/order.model';
import { User } from '../../../src/modules/users/user.model';
import { Product } from '../../../src/modules/products/product.model';
import { UserRole } from '../../../src/modules/auth/auth.types';
import { OrderStatus } from '../../../src/modules/orders/order.types';
import { ProductCategory } from '../../../src/modules/products/product.types';
import { authLimiter } from '../../../src/shared/middleware/rateLimiter';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/orders/order.model');
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/modules/products/product.model');
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
    stripe: { secretKey: '' },
  },
}));

const app = createApp();

// ── Token helpers ─────────────────────────────────────────────────────────────
const SECRET = 'test-secret-32-chars-minimum-len';
const USER_ID  = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ADMIN_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const userToken  = jwt.sign({ id: USER_ID,  email: 'user@example.com',  role: UserRole.USER  }, SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ id: ADMIN_ID, email: 'admin@example.com', role: UserRole.ADMIN }, SECRET, { expiresIn: '1h' });

// ── Fixtures ──────────────────────────────────────────────────────────────────
const orderId   = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();

const shippingAddress = {
  fullName:   'Jane Doe',
  line1:      '123 Main St',
  city:       'Cairo',
  state:      'Cairo Governorate',
  postalCode: '11511',
  country:    'Egypt',
};

const mockProduct = {
  _id: new mongoose.Types.ObjectId(productId),
  name: 'Test Jacket',
  image: 'http://localhost:4000/images/jacket.png',
  category: ProductCategory.WOMEN,
  new_price: 50,
  available: true,
};

const makeMockUser = (cartEntries: [string, number][] = []) => ({
  _id: new mongoose.Types.ObjectId(USER_ID),
  isActive: true,
  cartData: new Map<string, number>(cartEntries),
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
});

const mockOrderResponse = {
  id: orderId,
  userId: USER_ID,
  items: [{ productId, name: 'Test Jacket', image: 'http://localhost:4000/images/jacket.png', price: 50, quantity: 2, subtotal: 100 }],
  shippingAddress,
  status: OrderStatus.PENDING,
  total: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeMockOrder = (status = OrderStatus.PENDING, ownerId = USER_ID) => ({
  _id: new mongoose.Types.ObjectId(orderId),
  userId: new mongoose.Types.ObjectId(ownerId),
  status,
  total: 100,
  items: mockOrderResponse.items,
  shippingAddress,
  save: jest.fn().mockResolvedValue(undefined),
  toResponseObject: jest.fn().mockReturnValue({ ...mockOrderResponse, status }),
});

const mockChain = (data: unknown) => ({
  sort:  jest.fn().mockReturnThis(),
  skip:  jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(data),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Order routes', () => {

  beforeEach(async () => {
    jest.clearAllMocks();
    await authLimiter.resetKey('::ffff:127.0.0.1');
  });

  // ── POST /api/orders ─────────────────────────────────────────────────────────
  describe('POST /api/orders', () => {
    it('returns 201 when placing a valid order', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser([[productId, 2]]));
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);
      (Order.create as jest.Mock).mockResolvedValue(makeMockOrder());

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ shippingAddress });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(100);
      expect(res.body.data.status).toBe(OrderStatus.PENDING);
    });

    it('returns 400 when cart is empty', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser());

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ shippingAddress });

      expect(res.status).toBe(400);
    });

    it('returns 422 when shippingAddress is missing', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(422);
    });

    it('returns 422 when a required address field is missing', async () => {
      const { city: _city, ...incomplete } = shippingAddress;

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ shippingAddress: incomplete });

      expect(res.status).toBe(422);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ shippingAddress });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/orders/my ───────────────────────────────────────────────────────
  describe('GET /api/orders/my', () => {
    it('returns 200 with paginated order history', async () => {
      (Order.find as jest.Mock).mockReturnValue(mockChain([makeMockOrder()]));
      (Order.countDocuments as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/orders/my')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('returns 422 for an invalid status filter', async () => {
      const res = await request(app)
        .get('/api/orders/my')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ status: 'invalid-status' });

      expect(res.status).toBe(422);
    });
  });

  // ── GET /api/orders/:id ──────────────────────────────────────────────────────
  describe('GET /api/orders/:id', () => {
    it('returns 200 for the order owner', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder());

      const res = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderId);
    });

    it('returns 403 when non-owner requests another user\'s order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.PENDING, ADMIN_ID));

      const res = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 200 when admin requests any order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.PENDING, USER_ID));

      const res = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 422 for a malformed id', async () => {
      const res = await request(app)
        .get('/api/orders/not-an-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(422);
    });

    it('returns 404 when order does not exist', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/orders (admin) ───────────────────────────────────────────────────
  describe('GET /api/orders', () => {
    it('returns 200 with all orders for admin', async () => {
      (Order.find as jest.Mock).mockReturnValue(mockChain([makeMockOrder()]));
      (Order.countDocuments as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 403 for a regular user', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /api/orders/:id/status (admin) ─────────────────────────────────────
  describe('PATCH /api/orders/:id/status', () => {
    it('returns 200 on a valid status transition', async () => {
      const mockOrder = makeMockOrder(OrderStatus.PENDING);
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);

      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      expect(res.status).toBe(200);
    });

    it('returns 422 for an invalid status value', async () => {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'not-a-status' });

      expect(res.status).toBe(422);
    });

    it('returns 403 for a regular user', async () => {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/orders/:id/cancel ────────────────────────────────────────────
  describe('DELETE /api/orders/:id/cancel', () => {
    it('returns 200 when user cancels their own pending order', async () => {
      const mockOrder = makeMockOrder(OrderStatus.PENDING);
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);

      const res = await request(app)
        .delete(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Order cancelled successfully.');
    });

    it('returns 422 when trying to cancel a shipped order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.SHIPPED));

      const res = await request(app)
        .delete(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(422);
    });

    it('returns 403 when user tries to cancel another user\'s order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.PENDING, ADMIN_ID));

      const res = await request(app)
        .delete(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).delete(`/api/orders/${orderId}/cancel`);
      expect(res.status).toBe(401);
    });
  });
});