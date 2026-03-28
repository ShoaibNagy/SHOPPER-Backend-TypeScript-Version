import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../../src/app';
import { Product } from '../../../src/modules/products/product.model';
import { ProductCategory } from '../../../src/modules/products/product.types';
import { UserRole } from '../../../src/modules/auth/auth.types';
import jwt from 'jsonwebtoken';

// ── Mocks ─────────────────────────────────────────────────────────────────────
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
const makeToken = (role: UserRole) =>
  jwt.sign(
    { id: 'user-id-123', email: 'test@example.com', role },
    'test-secret-32-chars-minimum-len',
    { expiresIn: '1h' },
  );

const adminToken = makeToken(UserRole.ADMIN);
const userToken = makeToken(UserRole.USER);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockId = new mongoose.Types.ObjectId().toString();

const mockProductResponse = {
  id: mockId,
  name: 'Test Jacket',
  image: 'http://localhost:4000/images/jacket.png',
  category: ProductCategory.WOMEN,
  new_price: 49.99,
  old_price: 79.99,
  available: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProductDoc = {
  ...mockProductResponse,
  _id: new mongoose.Types.ObjectId(mockId),
  toResponseObject: jest.fn().mockReturnValue(mockProductResponse),
};

const mockLeanProduct = { ...mockProductResponse, _id: new mongoose.Types.ObjectId(mockId) };

const mockChain = (resolvedValue: unknown) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(resolvedValue),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Product routes', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── GET /api/products ───────────────────────────────────────────────────────
  describe('GET /api/products', () => {
    it('returns 200 with paginated products', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([mockLeanProduct]));
      (Product.countDocuments as jest.Mock).mockResolvedValue(1);

      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('accepts valid query params without error', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([]));
      (Product.countDocuments as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/products')
        .query({ category: 'women', minPrice: '10', maxPrice: '100', page: '1', limit: '10' });

      expect(res.status).toBe(200);
    });

    it('returns 422 for an invalid category', async () => {
      const res = await request(app)
        .get('/api/products')
        .query({ category: 'invalid-category' });

      expect(res.status).toBe(422);
    });
  });

  // ── GET /api/products/new-collection ───────────────────────────────────────
  describe('GET /api/products/new-collection', () => {
    it('returns 200 with an array of products', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([mockLeanProduct]));

      const res = await request(app).get('/api/products/new-collection');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── GET /api/products/popular/:category ────────────────────────────────────
  describe('GET /api/products/popular/:category', () => {
    it('returns 200 for a valid category', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([mockLeanProduct]));

      const res = await request(app).get('/api/products/popular/women');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 400 for an invalid category', async () => {
      const res = await request(app).get('/api/products/popular/invalid');

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/products/:id ───────────────────────────────────────────────────
  describe('GET /api/products/:id', () => {
    it('returns 200 for a valid id', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(mockProductDoc);

      const res = await request(app).get(`/api/products/${mockId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test Jacket');
    });

    it('returns 422 for a malformed id', async () => {
      const res = await request(app).get('/api/products/not-an-id');

      expect(res.status).toBe(422);
    });

    it('returns 404 when product does not exist', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get(`/api/products/${mockId}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/products ──────────────────────────────────────────────────────
  describe('POST /api/products', () => {
    const validBody = {
      name: 'Test Jacket',
      image: 'http://localhost:4000/images/jacket.png',
      category: 'women',
      new_price: 49.99,
      old_price: 79.99,
    };

    it('returns 201 when admin creates a product', async () => {
      (Product.create as jest.Mock).mockResolvedValue(mockProductDoc);

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Test Jacket');
    });

    it('returns 403 when a regular user attempts to create', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(app).post('/api/products').send(validBody);

      expect(res.status).toBe(401);
    });

    it('returns 422 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Jacket' }); // missing image, category, prices

      expect(res.status).toBe(422);
    });

    it('returns 422 for a negative price', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody, new_price: -5 });

      expect(res.status).toBe(422);
    });
  });

  // ── PATCH /api/products/:id ─────────────────────────────────────────────────
  describe('PATCH /api/products/:id', () => {
    it('returns 200 on a valid partial update', async () => {
      (Product.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockProductDoc,
        toResponseObject: jest.fn().mockReturnValue({ ...mockProductResponse, new_price: 39.99 }),
      });

      const res = await request(app)
        .patch(`/api/products/${mockId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ new_price: 39.99 });

      expect(res.status).toBe(200);
      expect(res.body.data.new_price).toBe(39.99);
    });

    it('returns 403 for a non-admin user', async () => {
      const res = await request(app)
        .patch(`/api/products/${mockId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ new_price: 39.99 });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/products/:id ────────────────────────────────────────────────
  describe('DELETE /api/products/:id', () => {
    it('returns 200 on successful delete', async () => {
      (Product.findByIdAndDelete as jest.Mock).mockResolvedValue(mockProductDoc);

      const res = await request(app)
        .delete(`/api/products/${mockId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).delete(`/api/products/${mockId}`);

      expect(res.status).toBe(401);
    });

    it('returns 404 when product does not exist', async () => {
      (Product.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/products/${mockId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});