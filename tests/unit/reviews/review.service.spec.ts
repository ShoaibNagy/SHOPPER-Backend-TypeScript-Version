import mongoose from 'mongoose';
import { reviewService } from '../../../src/modules/reviews/review.service';
import { Review } from '../../../src/modules/reviews/review.model';
import { Product } from '../../../src/modules/products/product.model';
import { Order } from '../../../src/modules/orders/order.model';
import { User } from '../../../src/modules/users/user.model';
import { AppError } from '../../../src/shared/middleware/errorHandler';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/reviews/review.model');
jest.mock('../../../src/modules/products/product.model');
jest.mock('../../../src/modules/orders/order.model');
jest.mock('../../../src/modules/users/user.model');

// ── Fixtures ──────────────────────────────────────────────────────────────────
const userId    = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();
const reviewId  = new mongoose.Types.ObjectId().toString();

const mockReviewResponse = {
  id:        reviewId,
  userId,
  username:  'testuser',
  productId,
  rating:    5,
  comment:   'Great product!',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeMockReview = (ownerId = userId) => ({
  _id:             new mongoose.Types.ObjectId(reviewId),
  userId:          new mongoose.Types.ObjectId(ownerId),
  username:        'testuser',
  productId:       new mongoose.Types.ObjectId(productId),
  rating:          5,
  comment:         'Great product!',
  createdAt:       new Date(),
  updatedAt:       new Date(),
  toResponseObject: jest.fn().mockReturnValue(mockReviewResponse),
});

const mockChain = (data: unknown) => ({
  sort:  jest.fn().mockReturnThis(),
  skip:  jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(data),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('reviewService', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── getReviewsByProduct ───────────────────────────────────────────────────────
  describe('getReviewsByProduct', () => {
    it('returns paginated reviews for a valid product', async () => {
      (Product.exists as jest.Mock).mockResolvedValue({ _id: productId });
      (Review.find as jest.Mock).mockReturnValue(mockChain([makeMockReview()]));
      (Review.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await reviewService.getReviewsByProduct(productId, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].rating).toBe(5);
      expect(result.pagination.total).toBe(1);
    });

    it('throws 404 when product does not exist', async () => {
      (Product.exists as jest.Mock).mockResolvedValue(null);

      await expect(
        reviewService.getReviewsByProduct(productId, {}),
      ).rejects.toThrow(new AppError('Product not found.', 404));
    });

    it('throws 400 for a malformed productId', async () => {
      await expect(
        reviewService.getReviewsByProduct('bad-id', {}),
      ).rejects.toThrow(new AppError('Invalid product ID.', 400));
    });
  });

  // ── createReview ──────────────────────────────────────────────────────────────
  describe('createReview', () => {
    const dto = { productId, rating: 5, comment: 'Great product!' };

    it('creates and returns a review for a verified purchaser', async () => {
      (Product.findById as jest.Mock).mockResolvedValue({ _id: productId });
      (Order.exists as jest.Mock).mockResolvedValue({ _id: 'order-id' });
      (Review.findOne as jest.Mock).mockResolvedValue(null);
      (User.findById as jest.Mock).mockResolvedValue({ username: 'testuser' });
      (Review.create as jest.Mock).mockResolvedValue(makeMockReview());

      const result = await reviewService.createReview(userId, dto);

      expect(result.rating).toBe(5);
      expect(result.comment).toBe('Great product!');
      expect(Review.create).toHaveBeenCalledTimes(1);
    });

    it('throws 403 when user has no delivered order for the product', async () => {
      (Product.findById as jest.Mock).mockResolvedValue({ _id: productId });
      (Order.exists as jest.Mock).mockResolvedValue(null);

      await expect(
        reviewService.createReview(userId, dto),
      ).rejects.toThrow(
        new AppError('You can only review products from your delivered orders.', 403),
      );
    });

    it('throws 409 when user has already reviewed the product', async () => {
      (Product.findById as jest.Mock).mockResolvedValue({ _id: productId });
      (Order.exists as jest.Mock).mockResolvedValue({ _id: 'order-id' });
      (Review.findOne as jest.Mock).mockResolvedValue(makeMockReview());

      await expect(
        reviewService.createReview(userId, dto),
      ).rejects.toThrow(new AppError('You have already reviewed this product.', 409));
    });

    it('throws 404 when product does not exist', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        reviewService.createReview(userId, dto),
      ).rejects.toThrow(new AppError('Product not found.', 404));
    });

    it('throws 400 for a malformed productId', async () => {
      await expect(
        reviewService.createReview(userId, { ...dto, productId: 'bad-id' }),
      ).rejects.toThrow(new AppError('Invalid product ID.', 400));
    });
  });

  // ── deleteReview ──────────────────────────────────────────────────────────────
  describe('deleteReview', () => {
    it('deletes a review for its owner', async () => {
      (Review.findById as jest.Mock).mockResolvedValue(makeMockReview());
      (Review.findByIdAndDelete as jest.Mock).mockResolvedValue(makeMockReview());

      await expect(
        reviewService.deleteReview(reviewId, userId, false),
      ).resolves.toBeUndefined();

      expect(Review.findByIdAndDelete).toHaveBeenCalledWith(reviewId);
    });

    it('allows admin to delete any review', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Review.findById as jest.Mock).mockResolvedValue(makeMockReview(otherUserId));
      (Review.findByIdAndDelete as jest.Mock).mockResolvedValue({});

      await expect(
        reviewService.deleteReview(reviewId, userId, true),
      ).resolves.toBeUndefined();
    });

    it('throws 403 when non-owner tries to delete', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Review.findById as jest.Mock).mockResolvedValue(makeMockReview(otherUserId));

      await expect(
        reviewService.deleteReview(reviewId, userId, false),
      ).rejects.toThrow(
        new AppError('You do not have permission to delete this review.', 403),
      );
    });

    it('throws 404 when review does not exist', async () => {
      (Review.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        reviewService.deleteReview(reviewId, userId, false),
      ).rejects.toThrow(new AppError('Review not found.', 404));
    });

    it('throws 400 for a malformed review id', async () => {
      await expect(
        reviewService.deleteReview('bad-id', userId, false),
      ).rejects.toThrow(new AppError('Invalid review ID.', 400));
    });
  });

  // ── getAverageRating ──────────────────────────────────────────────────────────
  describe('getAverageRating', () => {
    it('returns average rating and review count', async () => {
      (Review.getAverageRating as jest.Mock).mockResolvedValue(4.5);
      (Review.countDocuments as jest.Mock).mockResolvedValue(12);

      const result = await reviewService.getAverageRating(productId);

      expect(result.average).toBe(4.5);
      expect(result.count).toBe(12);
    });

    it('returns 0 average when no reviews exist', async () => {
      (Review.getAverageRating as jest.Mock).mockResolvedValue(0);
      (Review.countDocuments as jest.Mock).mockResolvedValue(0);

      const result = await reviewService.getAverageRating(productId);

      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });

    it('throws 400 for a malformed productId', async () => {
      await expect(
        reviewService.getAverageRating('bad-id'),
      ).rejects.toThrow(new AppError('Invalid product ID.', 400));
    });
  });
});