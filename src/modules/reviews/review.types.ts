export interface ReviewResponse {
    id: string;
    userId: string;
    username: string;
    productId: string;
    rating: number;
    comment: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface CreateReviewDTO {
    productId: string;
    rating: number;
    comment: string;
  }
  
  export interface ReviewQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    rating?: number;          // filter by exact rating (1–5)
    productId?: string;       // filter by product (admin list)
    userId?: string;          // filter by user (admin list)
  }