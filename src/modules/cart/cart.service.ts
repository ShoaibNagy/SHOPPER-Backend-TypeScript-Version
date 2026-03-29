import { User } from '../users/user.model';
import { Product } from '../products/product.model';
import { AppError } from '../../shared/middleware/errorHandler';
import {
  CartResponse,
  AddToCartDTO,
  RemoveFromCartDTO,
  UpdateCartItemDTO,
} from './cart.types';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Resolves the raw cartData Map (productId → quantity) into a fully
// populated CartResponse by joining against the products collection.
const buildCartResponse = async (
  cartData: Map<string, number>,
): Promise<CartResponse> => {
  // Filter out items with zero or negative quantities
  const activeEntries = [...cartData.entries()].filter(([, qty]) => qty > 0);

  if (activeEntries.length === 0) {
    return { items: [], totalItems: 0, totalPrice: 0 };
  }

  const productIds = activeEntries.map(([id]) => id);
  const products = await Product.find({ _id: { $in: productIds }, available: true });

  // Index products by id for O(1) lookup
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  let totalItems = 0;
  let totalPrice = 0;

  const items = activeEntries.reduce<CartResponse['items']>((acc, [productId, quantity]) => {
    const product = productMap.get(productId);
    // Skip if product was deleted or made unavailable since being added
    if (!product) return acc;

    const subtotal = product.new_price * quantity;
    totalItems += quantity;
    totalPrice += subtotal;

    acc.push({
      productId,
      name: product.name,
      image: product.image,
      new_price: product.new_price,
      quantity,
      subtotal,
    });

    return acc;
  }, []);

  return {
    items,
    totalItems,
    totalPrice: Math.round(totalPrice * 100) / 100, // avoid floating-point drift
  };
};

// ── Service operations ────────────────────────────────────────────────────────

const getCart = async (userId: string): Promise<CartResponse> => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  const cartData = user.cartData as unknown as Map<string, number>;
  return buildCartResponse(cartData);
};

const addToCart = async (userId: string, dto: AddToCartDTO): Promise<CartResponse> => {
  const quantity = dto.quantity ?? 1;

  if (quantity < 1) {
    throw new AppError('Quantity must be at least 1.', 400);
  }

  // Validate product exists and is available
  const product = await Product.findById(dto.productId);
  if (!product || !product.available) {
    throw new AppError('Product not found or unavailable.', 404);
  }

  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  const cartData = user.cartData as unknown as Map<string, number>;
  const current = cartData.get(dto.productId) ?? 0;
  cartData.set(dto.productId, current + quantity);

  // Mark the Map as modified so Mongoose detects the nested change
  user.markModified('cartData');
  await user.save();

  return buildCartResponse(cartData);
};

const removeFromCart = async (
  userId: string,
  dto: RemoveFromCartDTO,
): Promise<CartResponse> => {
  const quantity = dto.quantity ?? 1;

  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  const cartData = user.cartData as unknown as Map<string, number>;
  const current = cartData.get(dto.productId) ?? 0;

  if (current === 0) {
    throw new AppError('Product is not in the cart.', 400);
  }

  // quantity === -1 means remove entirely regardless of current count
  if (quantity === -1 || current - quantity <= 0) {
    cartData.delete(dto.productId);
  } else {
    cartData.set(dto.productId, current - quantity);
  }

  user.markModified('cartData');
  await user.save();

  return buildCartResponse(cartData);
};

const updateCartItem = async (
  userId: string,
  dto: UpdateCartItemDTO,
): Promise<CartResponse> => {
  if (dto.quantity < 0) {
    throw new AppError('Quantity cannot be negative.', 400);
  }

  // Validate product exists when setting a non-zero quantity
  if (dto.quantity > 0) {
    const product = await Product.findById(dto.productId);
    if (!product || !product.available) {
      throw new AppError('Product not found or unavailable.', 404);
    }
  }

  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  const cartData = user.cartData as unknown as Map<string, number>;

  if (dto.quantity === 0) {
    cartData.delete(dto.productId);
  } else {
    cartData.set(dto.productId, dto.quantity);
  }

  user.markModified('cartData');
  await user.save();

  return buildCartResponse(cartData);
};

const clearCart = async (userId: string): Promise<void> => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  const cartData = user.cartData as unknown as Map<string, number>;
  cartData.clear();

  user.markModified('cartData');
  await user.save();
};

export const cartService = {
  getCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  clearCart,
};