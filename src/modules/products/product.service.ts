import mongoose from 'mongoose';
import { Product, IProduct } from './product.model';
import { AppError } from '../../shared/middleware/errorHandler';
import {
  parsePaginationQuery,
  buildPaginatedResult,
  PaginationOptions,
} from '../../shared/utils/pagination';
import {
  CreateProductDTO,
  UpdateProductDTO,
  ProductResponse,
  ProductQuery,
  ProductCategory,
} from './product.types';
import { PaginatedResult } from '../../shared/types/common.types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const buildFilterQuery = (
  query: ProductQuery,
): mongoose.FilterQuery<IProduct> => {
  const filter: mongoose.FilterQuery<IProduct> = {};

  if (query.category) {
    filter['category'] = query.category;
  }

  if (query.available !== undefined) {
    filter['available'] = query.available;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter['new_price'] = {
      ...(query.minPrice !== undefined && { $gte: query.minPrice }),
      ...(query.maxPrice !== undefined && { $lte: query.maxPrice }),
    };
  }

  if (query.search) {
    filter['$text'] = { $search: query.search };
  }

  return filter;
};

// ── Service operations ───────────────────────────────────────────────────────

const getAllProducts = async (
  query: ProductQuery,
): Promise<PaginatedResult<ProductResponse>> => {
  const options: PaginationOptions = parsePaginationQuery(query);
  const filter = buildFilterQuery(query);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ [options.sortBy]: options.sortOrder })
      .skip(options.skip)
      .limit(options.limit)
      .lean<IProduct[]>(),
    Product.countDocuments(filter),
  ]);

  const data = products.map((p) => ({
    id: (p._id as mongoose.Types.ObjectId).toString(),
    name: p.name,
    image: p.image,
    category: p.category,
    new_price: p.new_price,
    old_price: p.old_price,
    available: p.available,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  return buildPaginatedResult(data, total, options);
};

const getProductById = async (id: string): Promise<ProductResponse> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid product ID.', 400);
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError('Product not found.', 404);
  }

  return product.toResponseObject();
};

const createProduct = async (dto: CreateProductDTO): Promise<ProductResponse> => {
  const product = await Product.create({
    name: dto.name,
    image: dto.image,
    category: dto.category,
    new_price: dto.new_price,
    old_price: dto.old_price,
  });

  return product.toResponseObject();
};

const updateProduct = async (
  id: string,
  dto: UpdateProductDTO,
): Promise<ProductResponse> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid product ID.', 400);
  }

  const product = await Product.findByIdAndUpdate(
    id,
    { $set: dto },
    { new: true, runValidators: true },
  );

  if (!product) {
    throw new AppError('Product not found.', 404);
  }

  return product.toResponseObject();
};

const deleteProduct = async (id: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid product ID.', 400);
  }

  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    throw new AppError('Product not found.', 404);
  }
};

const getNewCollection = async (): Promise<ProductResponse[]> => {
  const products = await Product.find({ available: true })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean<IProduct[]>();

  return products.map((p) => ({
    id: (p._id as mongoose.Types.ObjectId).toString(),
    name: p.name,
    image: p.image,
    category: p.category,
    new_price: p.new_price,
    old_price: p.old_price,
    available: p.available,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
};

const getPopularInCategory = async (
  category: ProductCategory,
  limit = 4,
): Promise<ProductResponse[]> => {
  const products = await Product.find({ category, available: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<IProduct[]>();

  return products.map((p) => ({
    id: (p._id as mongoose.Types.ObjectId).toString(),
    name: p.name,
    image: p.image,
    category: p.category,
    new_price: p.new_price,
    old_price: p.old_price,
    available: p.available,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
};

export const productService = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getNewCollection,
  getPopularInCategory,
};