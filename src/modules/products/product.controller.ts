import { Request, Response } from 'express';
import { productService } from './product.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { AppError } from '../../shared/middleware/errorHandler';
import { ApiResponse } from '../../shared/types/common.types';
import {
  CreateProductDTO,
  UpdateProductDTO,
  ProductResponse,
  ProductQuery,
  ProductCategory,
} from './product.types';
import { env } from '../../config/env';

// GET /api/products
export const getAllProductsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query: ProductQuery = {
      page: req.query['page'] ? Number(req.query['page']) : undefined,
      limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
      sortBy: req.query['sortBy'] as string | undefined,
      sortOrder: req.query['sortOrder'] as 'asc' | 'desc' | undefined,
      search: req.query['search'] as string | undefined,
      category: req.query['category'] as ProductCategory | undefined,
      available: req.query['available'] !== undefined
        ? req.query['available'] === 'true'
        : undefined,
      minPrice: req.query['minPrice'] ? Number(req.query['minPrice']) : undefined,
      maxPrice: req.query['maxPrice'] ? Number(req.query['maxPrice']) : undefined,
    };

    const result = await productService.getAllProducts(query);
    res.status(200).json({ success: true, ...result });
  },
);

// GET /api/products/new-collection
export const getNewCollectionHandler = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const products = await productService.getNewCollection();
    const response: ApiResponse<ProductResponse[]> = {
      success: true,
      data: products,
    };
    res.status(200).json(response);
  },
);

// GET /api/products/popular/:category
export const getPopularInCategoryHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const category = req.params['category'] as ProductCategory;
    const validCategories = Object.values(ProductCategory) as string[];

    if (!validCategories.includes(category)) {
      throw new AppError(
        `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        400,
      );
    }

    const products = await productService.getPopularInCategory(category);
    const response: ApiResponse<ProductResponse[]> = {
      success: true,
      data: products,
    };
    res.status(200).json(response);
  },
);

// GET /api/products/:id
export const getProductByIdHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const product = await productService.getProductById(req.params['id'] as string);
    const response: ApiResponse<ProductResponse> = {
      success: true,
      data: product,
    };
    res.status(200).json(response);
  },
);

// POST /api/products
export const createProductHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: CreateProductDTO = {
      name: req.body.name as string,
      image: req.body.image as string,
      category: req.body.category as ProductCategory,
      new_price: Number(req.body.new_price),
      old_price: Number(req.body.old_price),
    };

    const product = await productService.createProduct(dto);
    const response: ApiResponse<ProductResponse> = {
      success: true,
      message: 'Product created successfully.',
      data: product,
    };
    res.status(201).json(response);
  },
);

// PATCH /api/products/:id
export const updateProductHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: UpdateProductDTO = {};

    if (req.body.name !== undefined) dto.name = req.body.name as string;
    if (req.body.image !== undefined) dto.image = req.body.image as string;
    if (req.body.category !== undefined) dto.category = req.body.category as ProductCategory;
    if (req.body.new_price !== undefined) dto.new_price = Number(req.body.new_price);
    if (req.body.old_price !== undefined) dto.old_price = Number(req.body.old_price);
    if (req.body.available !== undefined) dto.available = Boolean(req.body.available);

    const product = await productService.updateProduct(req.params['id'] as string, dto);
    const response: ApiResponse<ProductResponse> = {
      success: true,
      message: 'Product updated successfully.',
      data: product,
    };
    res.status(200).json(response);
  },
);

// DELETE /api/products/:id
export const deleteProductHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await productService.deleteProduct(req.params['id'] as string);
    const response: ApiResponse = {
      success: true,
      message: 'Product deleted successfully.',
    };
    res.status(200).json(response);
  },
);

// POST /api/products/upload
export const uploadImageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError('No image file provided.', 400);
    }

    const imageUrl = `http://localhost:${env.node.port}/images/${req.file.filename}`;
    const response: ApiResponse<{ image_url: string }> = {
      success: true,
      data: { image_url: imageUrl },
    };
    res.status(200).json(response);
  },
);