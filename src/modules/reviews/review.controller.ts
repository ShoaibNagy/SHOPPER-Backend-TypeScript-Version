import { Request, Response } from 'express';
import { reviewService } from './review.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { ApiResponse } from '../../shared/types/common.types';
import { UserRole } from '../auth/auth.types';
import { CreateReviewDTO, ReviewResponse, ReviewQuery } from './review.types';

// GET /api/reviews/product/:productId
export const getReviewsByProductHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query: ReviewQuery = {
      page:      req.query['page'] ? Number(req.query['page']) : undefined,
      limit:     req.query['limit'] ? Number(req.query['limit']) : undefined,
      sortBy:    req.query['sortBy'] as string | undefined,
      sortOrder: req.query['sortOrder'] as 'asc' | 'desc' | undefined,
      rating:    req.query['rating'] ? Number(req.query['rating']) : undefined,
    };

    const result = await reviewService.getReviewsByProduct(
      req.params['productId'] as string,
      query,
    );

    res.status(200).json({ success: true, ...result });
  },
);

// GET /api/reviews/product/:productId/rating
export const getAverageRatingHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await reviewService.getAverageRating(
      req.params['productId'] as string,
    );

    const response: ApiResponse<{ average: number; count: number }> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  },
);

// POST /api/reviews
export const createReviewHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: CreateReviewDTO = {
      productId: req.body.productId as string,
      rating:    Number(req.body.rating),
      comment:   req.body.comment as string,
    };

    const review = await reviewService.createReview(req.user!.id, dto);

    const response: ApiResponse<ReviewResponse> = {
      success: true,
      message: 'Review submitted successfully.',
      data: review,
    };
    res.status(201).json(response);
  },
);

// DELETE /api/reviews/:id
export const deleteReviewHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const isAdmin = req.user!.role === UserRole.ADMIN;

    await reviewService.deleteReview(
      req.params['id'] as string,
      req.user!.id,
      isAdmin,
    );

    const response: ApiResponse = {
      success: true,
      message: 'Review deleted successfully.',
    };
    res.status(200).json(response);
  },
);

// GET /api/reviews  (admin)
export const getAllReviewsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query: ReviewQuery = {
      page:      req.query['page'] ? Number(req.query['page']) : undefined,
      limit:     req.query['limit'] ? Number(req.query['limit']) : undefined,
      sortBy:    req.query['sortBy'] as string | undefined,
      sortOrder: req.query['sortOrder'] as 'asc' | 'desc' | undefined,
      rating:    req.query['rating'] ? Number(req.query['rating']) : undefined,
      productId: req.query['productId'] as string | undefined,
      userId:    req.query['userId'] as string | undefined,
    };

    const result = await reviewService.getAllReviews(query);
    res.status(200).json({ success: true, ...result });
  },
);