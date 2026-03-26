import { PaginationQuery, PaginatedResult } from '../types/common.types';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 1 | -1;
}

export const parsePaginationQuery = (query: PaginationQuery): PaginationOptions => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  return { page, limit, skip, sortBy, sortOrder };
};

export const buildPaginatedResult = <T>(
  data: T[],
  total: number,
  options: PaginationOptions,
): PaginatedResult<T> => {
  const totalPages = Math.ceil(total / options.limit);

  return {
    data,
    pagination: {
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPrevPage: options.page > 1,
    },
  };
};