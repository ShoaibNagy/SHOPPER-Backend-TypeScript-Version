import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { User } from '../../../src/modules/users/user.model';
import { Product } from '../../../src/modules/products/product.model';
import { UserRole } from '../../../src/modules/auth/auth.types';
import { ProductCategory } from '../../../src/modules/products/product.types';
import { authLimiter } from '../../../src/shared/middleware/rateLimiter';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/modules/products/product.model');
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
const userToken = jwt.sign(
  { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'test@example.com', role: UserRole.USER },
  SECRET,
  { expiresIn: '1h' },
);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const productId = new mongoose.Types.ObjectId().toString();

const mockProduct = {
  _id: new mongoose.Types.ObjectId(productId),
  name: 'Test Jacket',
  image: 'http://localhost:4000/images/jacket.png',
  category: ProductCategory.WOMEN,
  new_price: 50,
  old_price: 80,
  available: true,
};

const makeMockUser = (cartEntries: [string, number][] = []) => ({
  _id: new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'),
  isActive: true,
  cartData: new Map<string, number>(cartEntries),
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Cart routes', () => {

  beforeEach(async () => {
    jest.clearAllMocks();
    await authLimiter.resetKey('::ffff:127.0.0.1');
  });

  // ── GET /api/cart ───────────────────────────────────────────────────────────
  describe('GET /api/cart', () => {
    it('returns 200 with empty cart', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser());
      (Product.find as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.totalPrice).toBe(0);
    });

    it('returns 200 with populated cart', async () => {
      (User.findById as jest.Mock).mockResolvedValue(
        makeMockUser([[productId, 2]]),
      );
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.totalItems).toBe(2);
      expect(res.body.data.totalPrice).toBe(100);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/cart');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/cart/items ────────────────────────────────────────────────────
  describe('POST /api/cart/items', () => {
    it('returns 200 when adding a valid product', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser());
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Item added to cart.');
      expect(res.body.data.items).toHaveLength(1);
    });

    it('returns 422 when productId is missing', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(422);
    });

    it('returns 422 for a non-MongoId productId', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 'not-an-id' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for a non-integer quantity', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 1.5 });

      expect(res.status).toBe(422);
    });

    it('returns 404 for an unavailable product', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId });

      expect(res.status).toBe(404);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .send({ productId });

      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /api/cart/items ───────────────────────────────────────────────────
  describe('PATCH /api/cart/items', () => {
    it('returns 200 on a valid quantity update', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser([[productId, 2]]));
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      const res = await request(app)
        .patch('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('returns 200 and removes item when quantity is 0', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser([[productId, 2]]));
      (Product.find as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .patch('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('returns 422 for a negative quantity', async () => {
      const res = await request(app)
        .patch('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: -2 });

      expect(res.status).toBe(422);
    });
  });

  // ── DELETE /api/cart/items ──────────────────────────────────────────────────
  describe('DELETE /api/cart/items', () => {
    it('returns 200 on valid removal', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser([[productId, 3]]));
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      const res = await request(app)
        .delete('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(2);
    });

    it('returns 200 when quantity is -1 (remove entirely)', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser([[productId, 5]]));
      (Product.find as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .delete('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: -1 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('returns 422 for an invalid quantity', async () => {
      const res = await request(app)
        .delete('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: -5 });

      expect(res.status).toBe(422);
    });
  });

  // ── DELETE /api/cart ────────────────────────────────────────────────────────
  describe('DELETE /api/cart', () => {
    it('returns 200 on successful cart clear', async () => {
      (User.findById as jest.Mock).mockResolvedValue(
        makeMockUser([[productId, 2]]),
      );

      const res = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Cart cleared.');
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).delete('/api/cart');
      expect(res.status).toBe(401);
    });
  });
});