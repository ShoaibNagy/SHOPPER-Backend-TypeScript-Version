import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { Review } from '../../../src/modules/reviews/review.model';
import { Product } from '../../../src/modules/products/product.model';
import { Order } from '../../../src/modules/orders/order.model';
import { User } from '../../../src/modules/users/user.model';
import { UserRole } from '../../../src/modules/auth/auth.types';
import { authLimiter } from '../../../src/shared/middleware/rateLimiter';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/reviews/review.model');
jest.mock('../../../src/modules/products/product.model');
jest.mock('../../../src/modules/orders/order.model');
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/config/env', () => ({
  env: {
    node: { env: 'test', isDev: false, isProd: false, port: 4000 },
    jwt: { secret: 'test-secret-32-chars-minimum-len', expiresIn: '7d' },
    bcrypt: { saltRounds: 10 },
    upload: { dir: 'upload/images', maxFileSizeMb: 5 },
    redis: { url: '' },
    stripe: { secretKey: '', webhookSecret: '' },
  },
}));
jest.mock('../../../src/config/stripe', () => ({
  stripe: { getClient: jest.fn(), init: jest.fn() },
}));

const app = createApp();

// ── Token helpers ─────────────────────────────────────────────────────────────
const SECRET   = 'test-secret-32-chars-minimum-len';
const USER_ID  = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ADMIN_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const userToken  = jwt.sign({ id: USER_ID,  email: 'user@example.com',  role: UserRole.USER  }, SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ id: ADMIN_ID, email: 'admin@example.com', role: UserRole.ADMIN }, SECRET, { expiresIn: '1h' });

// ── Fixtures ──────────────────────────────────────────────────────────────────
const productId = new mongoose.Types.ObjectId().toString();
const reviewId  = new mongoose.Types.ObjectId().toString();

const mockReviewResponse = {
  id:        reviewId,
  userId:    USER_ID,
  username:  'testuser',
  productId,
  rating:    5,
  comment:   'Great product!',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeMockReview = (ownerId = USER_ID) => ({
  _id:             new mongoose.Types.ObjectId(reviewId),
  userId:          new mongoose.Types.ObjectId(ownerId),
  productId:       new mongoose.Types.ObjectId(productId),
  rating:          5,
  comment:         'Great product!',
  toResponseObject: jest.fn().mockReturnValue(mockReviewResponse),
});

const mockChain = (data: unknown) => ({
  sort:  jest.fn().mockReturnThis(),
  skip:  jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(data),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Review routes', () => {

  beforeEach(async () => {
    jest.clearAllMocks();
    await authLimiter.resetKey('::ffff:127.0.0.1');
  });

  // ── GET /api/reviews/product/:productId ───────────────────────────────────────
  describe('GET /api/reviews/product/:productId', () => {
    it('returns 200 with paginated reviews', async () => {
      (Product.exists as jest.Mock).mockResolvedValue({ _id: productId });
      (Review.find as jest.Mock).mockReturnValue(mockChain([makeMockReview()]));
      (Review.countDocuments as jest.Mock).mockResolvedValue(1);

      const res = await request(app).get(`/api/reviews/product/${productId}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('returns 200 with an empty list when no reviews exist', async () => {
      (Product.exists as jest.Mock).mockResolvedValue({ _id: productId });
      (Review.find as jest.Mock).mockReturnValue(mockChain([]));
      (Review.countDocuments as jest.Mock).mockResolvedValue(0);

      const res = await request(app).get(`/api/reviews/product/${productId}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns 422 for a malformed productId', async () => {
      const res = await request(app).get('/api/reviews/product/not-an-id');

      expect(res.status).toBe(422);
    });

    it('returns 422 for an out-of-range rating filter', async () => {
      const res = await request(app)
        .get(`/api/reviews/product/${productId}`)
        .query({ rating: 6 });

      expect(res.status).toBe(422);
    });

    it('returns 404 when product does not exist', async () => {
      (Product.exists as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get(`/api/reviews/product/${productId}`);

      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/reviews/product/:productId/rating ────────────────────────────────
  describe('GET /api/reviews/product/:productId/rating', () => {
    it('returns 200 with average rating and count', async () => {
      (Review.getAverageRating as jest.Mock).mockResolvedValue(4.5);
      (Review.countDocuments as jest.Mock).mockResolvedValue(8);

      const res = await request(app).get(`/api/reviews/product/${productId}/rating`);

      expect(res.status).toBe(200);
      expect(res.body.data.average).toBe(4.5);
      expect(res.body.data.count).toBe(8);
    });

    it('returns 422 for a malformed productId', async () => {
      const res = await request(app).get('/api/reviews/product/not-an-id/rating');

      expect(res.status).toBe(422);
    });
  });

  // ── POST /api/reviews ─────────────────────────────────────────────────────────
  describe('POST /api/reviews', () => {
    const validBody = { productId, rating: 5, comment: 'Great product!' };

    it('returns 201 when a verified purchaser submits a review', async () => {
      (Product.findById as jest.Mock).mockResolvedValue({ _id: productId });
      (Order.exists as jest.Mock).mockResolvedValue({ _id: 'order-id' });
      (Review.findOne as jest.Mock).mockResolvedValue(null);
      (User.findById as jest.Mock).mockResolvedValue({ username: 'testuser' });
      (Review.create as jest.Mock).mockResolvedValue(makeMockReview());

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.comment).toBe('Great product!');
    });

    it('returns 403 when user has no delivered order for the product', async () => {
      (Product.findById as jest.Mock).mockResolvedValue({ _id: productId });
      (Order.exists as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 409 when user has already reviewed the product', async () => {
      (Product.findById as jest.Mock).mockResolvedValue({ _id: productId });
      (Order.exists as jest.Mock).mockResolvedValue({ _id: 'order-id' });
      (Review.findOne as jest.Mock).mockResolvedValue(makeMockReview());

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 422 when rating is out of range', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validBody, rating: 6 });

      expect(res.status).toBe(422);
    });

    it('returns 422 when comment is missing', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, rating: 4 });

      expect(res.status).toBe(422);
    });

    it('returns 422 for a non-MongoId productId', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validBody, productId: 'not-an-id' });

      expect(res.status).toBe(422);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).post('/api/reviews').send(validBody);

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/reviews/:id ───────────────────────────────────────────────────
  describe('DELETE /api/reviews/:id', () => {
    it('returns 200 when owner deletes their review', async () => {
      (Review.findById as jest.Mock).mockResolvedValue(makeMockReview());
      (Review.findByIdAndDelete as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Review deleted successfully.');
    });

    it('returns 200 when admin deletes any review', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Review.findById as jest.Mock).mockResolvedValue(makeMockReview(otherUserId));
      (Review.findByIdAndDelete as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 403 when non-owner tries to delete', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Review.findById as jest.Mock).mockResolvedValue(makeMockReview(otherUserId));

      const res = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 422 for a malformed review id', async () => {
      const res = await request(app)
        .delete('/api/reviews/not-an-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(422);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).delete(`/api/reviews/${reviewId}`);

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/reviews (admin) ──────────────────────────────────────────────────
  describe('GET /api/reviews', () => {
    it('returns 200 with all reviews for admin', async () => {
      (Review.find as jest.Mock).mockReturnValue(mockChain([makeMockReview()]));
      (Review.countDocuments as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/reviews')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 403 for a regular user', async () => {
      const res = await request(app)
        .get('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/reviews');

      expect(res.status).toBe(401);
    });

    it('returns 422 for an invalid productId filter', async () => {
      const res = await request(app)
        .get('/api/reviews')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ productId: 'not-an-id' });

      expect(res.status).toBe(422);
    });
  });
});