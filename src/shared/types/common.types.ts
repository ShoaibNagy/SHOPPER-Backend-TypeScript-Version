// Generic API response wrapper used by all endpoints
export interface ApiResponse<T = null> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string | string[];
}

// Paginated result wrapper for list endpoints
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Query params for list endpoints
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// Mongoose document base fields
export interface BaseDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}