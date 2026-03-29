import mongoose from 'mongoose';
import { orderService } from '../../../src/modules/orders/order.service';
import { Order } from '../../../src/modules/orders/order.model';
import { User } from '../../../src/modules/users/user.model';
import { Product } from '../../../src/modules/products/product.model';
import { AppError } from '../../../src/shared/middleware/errorHandler';
import { OrderStatus } from '../../../src/modules/orders/order.types';
import { ProductCategory } from '../../../src/modules/products/product.types';
import { eventBus } from '../../../src/shared/events/eventBus';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/orders/order.model');
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/modules/products/product.model');
jest.mock('../../../src/shared/events/eventBus', () => ({
  eventBus: { emit: jest.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const userId    = new mongoose.Types.ObjectId().toString();
const orderId   = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();

const shippingAddress = {
  fullName:   'Jane Doe',
  line1:      '123 Main St',
  city:       'Cairo',
  state:      'Cairo Governorate',
  postalCode: '11511',
  country:    'Egypt',
};

const mockProduct = {
  _id: new mongoose.Types.ObjectId(productId),
  name: 'Test Jacket',
  image: 'http://localhost:4000/images/jacket.png',
  category: ProductCategory.WOMEN,
  new_price: 50,
  available: true,
};

const makeMockUser = (cartEntries: [string, number][] = []) => ({
  _id: new mongoose.Types.ObjectId(userId),
  isActive: true,
  cartData: new Map<string, number>(cartEntries),
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
});

const mockOrderResponse = {
  id: orderId,
  userId,
  items: [{ productId, name: 'Test Jacket', image: 'http://localhost:4000/images/jacket.png', price: 50, quantity: 2, subtotal: 100 }],
  shippingAddress,
  status: OrderStatus.PENDING,
  total: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeMockOrder = (status = OrderStatus.PENDING) => ({
  _id: new mongoose.Types.ObjectId(orderId),
  userId: new mongoose.Types.ObjectId(userId),
  status,
  total: 100,
  items: mockOrderResponse.items,
  shippingAddress,
  save: jest.fn().mockResolvedValue(undefined),
  toResponseObject: jest.fn().mockReturnValue({ ...mockOrderResponse, status }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('orderService', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── placeOrder ───────────────────────────────────────────────────────────────
  describe('placeOrder', () => {
    it('creates an order and clears the cart', async () => {
      const mockUser = makeMockUser([[productId, 2]]);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Product.find as jest.Mock).mockResolvedValue([mockProduct]);
      (Order.create as jest.Mock).mockResolvedValue(makeMockOrder());

      const result = await orderService.placeOrder(userId, { shippingAddress });

      expect(result.total).toBe(100);
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(mockUser.cartData.size).toBe(0);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith('order.placed', expect.objectContaining({ userId }));
    });

    it('throws 400 when the cart is empty', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser());

      await expect(
        orderService.placeOrder(userId, { shippingAddress }),
      ).rejects.toThrow(new AppError('Cannot place an order with an empty cart.', 400));
    });

    it('throws 409 when a cart item is no longer available', async () => {
      (User.findById as jest.Mock).mockResolvedValue(makeMockUser([[productId, 2]]));
      // Product.find returns empty — product was deleted or made unavailable
      (Product.find as jest.Mock).mockResolvedValue([]);

      await expect(
        orderService.placeOrder(userId, { shippingAddress }),
      ).rejects.toThrow(new AppError('One or more items in your cart are no longer available. Please review your cart.', 409));
    });

    it('throws 404 when user does not exist', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        orderService.placeOrder(userId, { shippingAddress }),
      ).rejects.toThrow(new AppError('User not found.', 404));
    });
  });

  // ── getOrderById ─────────────────────────────────────────────────────────────
  describe('getOrderById', () => {
    it('returns the order for its owner', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder());

      const result = await orderService.getOrderById(orderId, userId, false);

      expect(result.id).toBe(orderId);
    });

    it('returns any order for an admin', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder());

      const result = await orderService.getOrderById(orderId, otherUserId, true);

      expect(result.id).toBe(orderId);
    });

    it('throws 403 when a non-admin requests another user\'s order', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder());

      await expect(
        orderService.getOrderById(orderId, otherUserId, false),
      ).rejects.toThrow(new AppError('You do not have permission to view this order.', 403));
    });

    it('throws 404 when order does not exist', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        orderService.getOrderById(orderId, userId, false),
      ).rejects.toThrow(new AppError('Order not found.', 404));
    });

    it('throws 400 for a malformed id', async () => {
      await expect(
        orderService.getOrderById('bad-id', userId, false),
      ).rejects.toThrow(new AppError('Invalid order ID.', 400));
    });
  });

  // ── updateOrderStatus ─────────────────────────────────────────────────────────
  describe('updateOrderStatus', () => {
    it('transitions from PENDING to CONFIRMED', async () => {
      const mockOrder = makeMockOrder(OrderStatus.PENDING);
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);

      await orderService.updateOrderStatus(orderId, { status: OrderStatus.CONFIRMED });

      expect(mockOrder.status).toBe(OrderStatus.CONFIRMED);
      expect(mockOrder.save).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith('order.statusChanged', expect.objectContaining({
        status: OrderStatus.CONFIRMED,
      }));
    });

    it('throws 422 for an invalid state transition', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.DELIVERED));

      await expect(
        orderService.updateOrderStatus(orderId, { status: OrderStatus.PENDING }),
      ).rejects.toThrow(new AppError(`Cannot transition order from 'delivered' to 'pending'.`, 422));
    });

    it('throws 404 when order does not exist', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        orderService.updateOrderStatus(orderId, { status: OrderStatus.CONFIRMED }),
      ).rejects.toThrow(new AppError('Order not found.', 404));
    });
  });

  // ── cancelOrder ──────────────────────────────────────────────────────────────
  describe('cancelOrder', () => {
    it('cancels a PENDING order for its owner', async () => {
      const mockOrder = makeMockOrder(OrderStatus.PENDING);
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);

      await orderService.cancelOrder(orderId, userId, false);

      expect(mockOrder.status).toBe(OrderStatus.CANCELLED);
      expect(mockOrder.save).toHaveBeenCalledTimes(1);
    });

    it('throws 422 when cancelling a SHIPPED order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.SHIPPED));

      await expect(
        orderService.cancelOrder(orderId, userId, false),
      ).rejects.toThrow(new AppError(`Order cannot be cancelled once it has reached 'shipped' status.`, 422));
    });

    it('throws 403 when a non-admin cancels another user\'s order', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      (Order.findById as jest.Mock).mockResolvedValue(makeMockOrder(OrderStatus.PENDING));

      await expect(
        orderService.cancelOrder(orderId, otherUserId, false),
      ).rejects.toThrow(new AppError('You do not have permission to cancel this order.', 403));
    });

    it('allows admin to cancel any cancellable order', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      const mockOrder = makeMockOrder(OrderStatus.CONFIRMED);
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);

      await orderService.cancelOrder(orderId, otherUserId, true);

      expect(mockOrder.status).toBe(OrderStatus.CANCELLED);
    });
  });
});