import mongoose from 'mongoose';
import { cartService } from '../../../src/modules/cart/cart.service';
import { User } from '../../../src/modules/users/user.model';
import { Product } from '../../../src/modules/products/product.model';
import { AppError } from '../../../src/shared/middleware/errorHandler';
import { ProductCategory } from '../../../src/modules/products/product.types';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/modules/products/product.model');

// ── Fixtures ──────────────────────────────────────────────────────────────────
const userId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();
const productId2 = new mongoose.Types.ObjectId().toString();

const mockProduct = {
  _id: new mongoose.Types.ObjectId(productId),
  name: 'Test Jacket',
  image: 'http://localhost:4000/images/jacket.png',
  category: ProductCategory.WOMEN,
  new_price: 50,
  old_price: 80,
  available: true,
};

// Builds a mock user with a real Map for cartData
const makeMockUser = (cartEntries: [string, number][] = []) => ({
  _id: new mongoose.Types.ObjectId(userId),
  isActive: true,
  cartData: new Map<string, number>(cartEntries),
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('cartService', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── getCart ─────────────────────────────────────────────────────────────────
  describe('getCart', () => {
    it('returns an empty cart when user has no items', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser());
      (Product.find as jest.Mock).mockResolvedValue([]);

      const result = await cartService.getCart(userId);

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
      expect(result.totalPrice).toBe(0);
    });

    it('returns populated cart items with correct totals', async () => {
      (User.findById as jest.Mock).mockResolvedValue(
        makeMockUser([[productId, 2]]),
      );
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      const result = await cartService.getCart(userId);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].subtotal).toBe(100);
      expect(result.totalItems).toBe(2);
      expect(result.totalPrice).toBe(100);
    });

    it('skips unavailable products silently', async () => {
      (User.findById as jest.Mock).mockResolvedValue(
        makeMockUser([[productId, 1], [productId2, 2]]),
      );
      // Product.find only returns one — the other was deleted/unavailable
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      const result = await cartService.getCart(userId);

      expect(result.items).toHaveLength(1);
      expect(result.totalItems).toBe(1);
    });

    it('throws 404 when user is not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(cartService.getCart(userId)).rejects.toThrow(
        new AppError('User not found.', 404),
      );
    });

    it('throws 404 when user is inactive', async () => {
      (User.findById as jest.Mock).mockResolvedValue({ ...makeMockUser(), isActive: false });

      await expect(cartService.getCart(userId)).rejects.toThrow(
        new AppError('User not found.', 404),
      );
    });
  });

  // ── addToCart ────────────────────────────────────────────────────────────────
  describe('addToCart', () => {
    it('adds a new product with quantity 1 by default', async () => {
      const mockUser = makeMockUser();
      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      await cartService.addToCart(userId, { productId });

      expect(mockUser.cartData.get(productId)).toBe(1);
      expect(mockUser.markModified).toHaveBeenCalledWith('cartData');
      expect(mockUser.save).toHaveBeenCalledTimes(1);
    });

    it('increments quantity when product already in cart', async () => {
      const mockUser = makeMockUser([[productId, 3]]);
      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      await cartService.addToCart(userId, { productId, quantity: 2 });

      expect(mockUser.cartData.get(productId)).toBe(5);
    });

    it('throws 404 for an unavailable product', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        cartService.addToCart(userId, { productId }),
      ).rejects.toThrow(new AppError('Product not found or unavailable.', 404));
    });

    it('throws 400 for quantity less than 1', async () => {
      await expect(
        cartService.addToCart(userId, { productId, quantity: 0 }),
      ).rejects.toThrow(new AppError('Quantity must be at least 1.', 400));
    });
  });

  // ── removeFromCart ───────────────────────────────────────────────────────────
  describe('removeFromCart', () => {
    it('decrements quantity by 1', async () => {
      const mockUser = makeMockUser([[productId, 3]]);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      await cartService.removeFromCart(userId, { productId });

      expect(mockUser.cartData.get(productId)).toBe(2);
    });

    it('removes the item entirely when quantity reaches zero', async () => {
      const mockUser = makeMockUser([[productId, 1]]);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Product.find as jest.Mock).mockResolvedValue([]);

      await cartService.removeFromCart(userId, { productId });

      expect(mockUser.cartData.has(productId)).toBe(false);
    });

    it('removes entirely when quantity is -1', async () => {
      const mockUser = makeMockUser([[productId, 5]]);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Product.find as jest.Mock).mockResolvedValue([]);

      await cartService.removeFromCart(userId, { productId, quantity: -1 });

      expect(mockUser.cartData.has(productId)).toBe(false);
    });

    it('throws 400 when product is not in cart', async () => {
      const mockUser = makeMockUser(); // empty cart
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        cartService.removeFromCart(userId, { productId }),
      ).rejects.toThrow(new AppError('Product is not in the cart.', 400));
    });
  });

  // ── updateCartItem ───────────────────────────────────────────────────────────
  describe('updateCartItem', () => {
    it('sets the item to an absolute quantity', async () => {
      const mockUser = makeMockUser([[productId, 2]]);
      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);

      await cartService.updateCartItem(userId, { productId, quantity: 7 });

      expect(mockUser.cartData.get(productId)).toBe(7);
    });

    it('removes the item when quantity is set to 0', async () => {
      const mockUser = makeMockUser([[productId, 3]]);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Product.find as jest.Mock).mockResolvedValue([]);

      await cartService.updateCartItem(userId, { productId, quantity: 0 });

      expect(mockUser.cartData.has(productId)).toBe(false);
    });

    it('throws 400 for a negative quantity', async () => {
      await expect(
        cartService.updateCartItem(userId, { productId, quantity: -1 }),
      ).rejects.toThrow(new AppError('Quantity cannot be negative.', 400));
    });
  });

  // ── clearCart ────────────────────────────────────────────────────────────────
  describe('clearCart', () => {
    it('empties all items from the cart', async () => {
      const mockUser = makeMockUser([[productId, 2], [productId2, 1]]);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await cartService.clearCart(userId);

      expect(mockUser.cartData.size).toBe(0);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
    });

    it('throws 404 when user is not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(cartService.clearCart(userId)).rejects.toThrow(
        new AppError('User not found.', 404),
      );
    });
  });
});