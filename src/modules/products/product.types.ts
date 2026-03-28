export enum ProductCategory {
  MEN = 'men',
  WOMEN = 'women',
  KIDS = 'kids',
}

export interface IProductBase {
  name: string;
  image: string;
  category: ProductCategory;
  new_price: number;
  old_price: number;
  available: boolean;
}

export interface CreateProductDTO {
  name: string;
  image: string;
  category: ProductCategory;
  new_price: number;
  old_price: number;
}

export interface UpdateProductDTO {
  name?: string;
  image?: string;
  category?: ProductCategory;
  new_price?: number;
  old_price?: number;
  available?: boolean;
}

export interface ProductResponse {
  id: string;
  name: string;
  image: string;
  category: ProductCategory;
  new_price: number;
  old_price: number;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  category?: ProductCategory;
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
}