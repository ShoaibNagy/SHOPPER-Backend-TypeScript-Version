import mongoose from 'mongoose';
import { Review, IReview } from './review.model';
import { Product } from '../products/product.model';
import { Order } from '../orders/order.model';
import { User } from '../users/user.model';
import { AppError } from '../../shared/middleware/errorHandler';
import { parsePaginationQuery, buildPaginatedResult, PaginationOptions } from '../../shared/utils/pagination';
import { PaginatedResult } from '../../shared/types/common.types';
import { OrderStatus } from '../orders/order.types';
import { CreateReviewDTO, ReviewResponse, ReviewQuery } from './review.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildFilterQuery = (query: ReviewQuery): mongoose.FilterQuery<IReview> => {
  const filter: mongoose.FilterQuery<IReview> = {};
  if (query.productId) filter['productId'] = new mongoose.Types.ObjectId(query.productId);
  if (query.userId)    filter['userId']    = new mongoose.Types.ObjectId(query.userId);
  if (query.rating)    filter['rating']    = query.rating;
  return filter;
};

// ── Service operations ────────────────────────────────────────────────────────

const getReviewsByProduct = async (
  productId: string,
  query: ReviewQuery,
): Promise<PaginatedResult<ReviewResponse>> => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID.', 400);
  }

  const productExists = await Product.exists({ _id: productId });
  if (!productExists) {
    throw new AppError('Product not found.', 404);
  }

  const options: PaginationOptions = parsePaginationQuery(query);
  const filter: mongoose.FilterQuery<IReview> = {
    productId: new mongoose.Types.ObjectId(productId),
    ...(query.rating && { rating: query.rating }),
  };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ [options.sortBy]: options.sortOrder })
      .skip(options.skip)
      .limit(options.limit),
    Review.countDocuments(filter),
  ]);

  return buildPaginatedResult(
    reviews.map((r) => r.toResponseObject()),
    total,
    options,
  );
};

const createReview = async (
  userId: string,
  dto: CreateReviewDTO,
): Promise<ReviewResponse> => {
  if (!mongoose.Types.ObjectId.isValid(dto.productId)) {
    throw new AppError('Invalid product ID.', 400);
  }

  // Verify product exists
  const product = await Product.findById(dto.productId);
  if (!product) {
    throw new AppError('Product not found.', 404);
  }

  // Verify user has a delivered order containing this product
  const hasPurchased = await Order.exists({
    userId,
    status: OrderStatus.DELIVERED,
    'items.productId': dto.productId,
  });

  if (!hasPurchased) {
    throw new AppError(
      'You can only review products from your delivered orders.',
      403,
    );
  }

  // Enforce one review per user per product (index handles DB-level uniqueness,
  // but we give a friendlier error message here)
  const existingReview = await Review.findOne({
    userId,
    productId: dto.productId,
  });

  if (existingReview) {
    throw new AppError('You have already reviewed this product.', 409);
  }

  // Fetch username for denormalisation
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  const review = await Review.create({
    userId,
    username: user.username,
    productId: dto.productId,
    rating: dto.rating,
    comment: dto.comment,
  });

  return review.toResponseObject();
};

const deleteReview = async (
  reviewId: string,
  requestingUserId: string,
  isAdmin: boolean,
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new AppError('Invalid review ID.', 400);
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw new AppError('Review not found.', 404);
  }

  // Non-admins can only delete their own reviews
  if (!isAdmin && review.userId.toString() !== requestingUserId) {
    throw new AppError('You do not have permission to delete this review.', 403);
  }

  await Review.findByIdAndDelete(reviewId);
};

const getAverageRating = async (productId: string): Promise<{ average: number; count: number }> => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID.', 400);
  }

  const [average, count] = await Promise.all([
    Review.getAverageRating(productId),
    Review.countDocuments({ productId: new mongoose.Types.ObjectId(productId) }),
  ]);

  return { average, count };
};

// ── Admin operations ──────────────────────────────────────────────────────────

const getAllReviews = async (
  query: ReviewQuery,
): Promise<PaginatedResult<ReviewResponse>> => {
  const options: PaginationOptions = parsePaginationQuery(query);
  const filter = buildFilterQuery(query);

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ [options.sortBy]: options.sortOrder })
      .skip(options.skip)
      .limit(options.limit),
    Review.countDocuments(filter),
  ]);

  return buildPaginatedResult(
    reviews.map((r) => r.toResponseObject()),
    total,
    options,
  );
};

export const reviewService = {
  getReviewsByProduct,
  createReview,
  deleteReview,
  getAverageRating,
  getAllReviews,
};