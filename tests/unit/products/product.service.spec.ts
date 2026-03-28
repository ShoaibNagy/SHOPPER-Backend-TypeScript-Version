import mongoose from 'mongoose';
import { productService } from '../../../src/modules/products/product.service';
import { Product } from '../../../src/modules/products/product.model';
import { AppError } from '../../../src/shared/middleware/errorHandler';
import { ProductCategory } from '../../../src/modules/products/product.types';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/products/product.model');

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockId = new mongoose.Types.ObjectId().toString();

const mockProduct = {
  _id: new mongoose.Types.ObjectId(mockId),
  name: 'Test Jacket',
  image: 'http://localhost:4000/images/jacket.png',
  category: ProductCategory.WOMEN,
  new_price: 49.99,
  old_price: 79.99,
  available: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  toResponseObject: jest.fn().mockReturnValue({
    id: mockId,
    name: 'Test Jacket',
    image: 'http://localhost:4000/images/jacket.png',
    category: ProductCategory.WOMEN,
    new_price: 49.99,
    old_price: 79.99,
    available: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

// lean() returns plain objects — no toResponseObject method
const mockLeanProduct = {
  _id: new mongoose.Types.ObjectId(mockId),
  name: 'Test Jacket',
  image: 'http://localhost:4000/images/jacket.png',
  category: ProductCategory.WOMEN,
  new_price: 49.99,
  old_price: 79.99,
  available: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Helper: chainable Mongoose query mock ─────────────────────────────────────
const mockChain = (resolvedValue: unknown) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(resolvedValue),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('productService', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── getAllProducts ──────────────────────────────────────────────────────────
  describe('getAllProducts', () => {
    it('returns a paginated result', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([mockLeanProduct]));
      (Product.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await productService.getAllProducts({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test Jacket');
      expect(result.pagination.total).toBe(1);
    });

    it('filters by category when provided', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([]));
      (Product.countDocuments as jest.Mock).mockResolvedValue(0);

      await productService.getAllProducts({ category: ProductCategory.MEN });

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({ category: ProductCategory.MEN }),
      );
    });

    it('filters by price range when provided', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([]));
      (Product.countDocuments as jest.Mock).mockResolvedValue(0);

      await productService.getAllProducts({ minPrice: 10, maxPrice: 50 });

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({ new_price: { $gte: 10, $lte: 50 } }),
      );
    });
  });

  // ── getProductById ──────────────────────────────────────────────────────────
  describe('getProductById', () => {
    it('returns the product for a valid id', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);

      const result = await productService.getProductById(mockId);

      expect(result.id).toBe(mockId);
      expect(result.name).toBe('Test Jacket');
    });

    it('throws 400 for a malformed id', async () => {
      await expect(productService.getProductById('not-an-id')).rejects.toThrow(
        new AppError('Invalid product ID.', 400),
      );
    });

    it('throws 404 when product does not exist', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(null);

      await expect(productService.getProductById(mockId)).rejects.toThrow(
        new AppError('Product not found.', 404),
      );
    });
  });

  // ── createProduct ───────────────────────────────────────────────────────────
  describe('createProduct', () => {
    it('creates and returns a product', async () => {
      (Product.create as jest.Mock).mockResolvedValue(mockProduct);

      const result = await productService.createProduct({
        name: 'Test Jacket',
        image: 'http://localhost:4000/images/jacket.png',
        category: ProductCategory.WOMEN,
        new_price: 49.99,
        old_price: 79.99,
      });

      expect(result.name).toBe('Test Jacket');
      expect(Product.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── updateProduct ───────────────────────────────────────────────────────────
  describe('updateProduct', () => {
    it('updates and returns the product', async () => {
      (Product.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockProduct,
        toResponseObject: jest.fn().mockReturnValue({
          ...mockProduct.toResponseObject(),
          new_price: 39.99,
        }),
      });

      const result = await productService.updateProduct(mockId, { new_price: 39.99 });

      expect(result.new_price).toBe(39.99);
      expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
        mockId,
        { $set: { new_price: 39.99 } },
        { new: true, runValidators: true },
      );
    });

    it('throws 404 when product does not exist', async () => {
      (Product.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(
        productService.updateProduct(mockId, { new_price: 39.99 }),
      ).rejects.toThrow(new AppError('Product not found.', 404));
    });

    it('throws 400 for a malformed id', async () => {
      await expect(
        productService.updateProduct('bad-id', { new_price: 39.99 }),
      ).rejects.toThrow(new AppError('Invalid product ID.', 400));
    });
  });

  // ── deleteProduct ───────────────────────────────────────────────────────────
  describe('deleteProduct', () => {
    it('deletes successfully without returning a value', async () => {
      (Product.findByIdAndDelete as jest.Mock).mockResolvedValue(mockProduct);

      await expect(productService.deleteProduct(mockId)).resolves.toBeUndefined();
    });

    it('throws 404 when product does not exist', async () => {
      (Product.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      await expect(productService.deleteProduct(mockId)).rejects.toThrow(
        new AppError('Product not found.', 404),
      );
    });
  });

  // ── getNewCollection ────────────────────────────────────────────────────────
  describe('getNewCollection', () => {
    it('returns the 8 most recent available products', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([mockLeanProduct]));

      const result = await productService.getNewCollection();

      expect(Product.find).toHaveBeenCalledWith({ available: true });
      expect(result).toHaveLength(1);
    });
  });

  // ── getPopularInCategory ────────────────────────────────────────────────────
  describe('getPopularInCategory', () => {
    it('returns products filtered by category', async () => {
      (Product.find as jest.Mock).mockReturnValue(mockChain([mockLeanProduct]));

      const result = await productService.getPopularInCategory(ProductCategory.WOMEN);

      expect(Product.find).toHaveBeenCalledWith({
        category: ProductCategory.WOMEN,
        available: true,
      });
      expect(result).toHaveLength(1);
    });
  });
});