import mongoose from 'mongoose';
import { Order, IOrder } from './order.model';
import { User } from '../users/user.model';
import { Product } from '../products/product.model';
import { AppError } from '../../shared/middleware/errorHandler';
import { eventBus } from '../../shared/events/eventBus';
import { parsePaginationQuery, buildPaginatedResult, PaginationOptions } from '../../shared/utils/pagination';
import { PaginatedResult } from '../../shared/types/common.types';
import {
  OrderResponse,
  PlaceOrderDTO,
  UpdateOrderStatusDTO,
  OrderQuery,
  OrderStatus,
  OrderItemSnapshot,
  ALLOWED_TRANSITIONS,
} from './order.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildFilterQuery = (
  query: OrderQuery,
): mongoose.FilterQuery<IOrder> => {
  const filter: mongoose.FilterQuery<IOrder> = {};
  if (query.status) filter['status'] = query.status;
  if (query.userId) filter['userId'] = query.userId;
  return filter;
};

// ── Service operations ────────────────────────────────────────────────────────

const placeOrder = async (
  userId: string,
  dto: PlaceOrderDTO,
): Promise<OrderResponse> => {
  // 1. Load user and their cart
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  const cartData = user.cartData as unknown as Map<string, number>;
  const activeEntries = [...cartData.entries()].filter(([, qty]) => qty > 0);

  if (activeEntries.length === 0) {
    throw new AppError('Cannot place an order with an empty cart.', 400);
  }

  // 2. Validate all cart products in a single query
  const productIds = activeEntries.map(([id]) => id);
  const products = await Product.find({
    _id: { $in: productIds },
    available: true,
  });

  if (products.length !== activeEntries.length) {
    throw new AppError(
      'One or more items in your cart are no longer available. Please review your cart.',
      409,
    );
  }

  // 3. Build price-locked item snapshots
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  let total = 0;

  const items: OrderItemSnapshot[] = activeEntries.map(([productId, quantity]) => {
    const product = productMap.get(productId)!;
    const subtotal = Math.round(product.new_price * quantity * 100) / 100;
    total += subtotal;

    return {
      productId,
      name:     product.name,
      image:    product.image,
      price:    product.new_price,
      quantity,
      subtotal,
    };
  });

  total = Math.round(total * 100) / 100;

  // 4. Create the order
  const order = await Order.create({
    userId,
    items,
    shippingAddress: dto.shippingAddress,
    status: OrderStatus.PENDING,
    total,
  });

  // 5. Clear the cart atomically after order is created
  cartData.clear();
  user.markModified('cartData');
  await user.save();

  // 6. Emit domain event
  eventBus.emit('order.placed', {
    orderId: order._id.toString(),
    userId,
    total,
  });

  return order.toResponseObject();
};

const getOrderById = async (
  orderId: string,
  requestingUserId: string,
  isAdmin: boolean,
): Promise<OrderResponse> => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new AppError('Invalid order ID.', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  // Non-admins can only see their own orders
  if (!isAdmin && order.userId.toString() !== requestingUserId) {
    throw new AppError('You do not have permission to view this order.', 403);
  }

  return order.toResponseObject();
};

const getMyOrders = async (
  userId: string,
  query: OrderQuery,
): Promise<PaginatedResult<OrderResponse>> => {
  const options: PaginationOptions = parsePaginationQuery(query);
  const filter: mongoose.FilterQuery<IOrder> = {
    userId,
    ...(query.status && { status: query.status }),
  };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ [options.sortBy]: options.sortOrder })
      .skip(options.skip)
      .limit(options.limit),
    Order.countDocuments(filter),
  ]);

  return buildPaginatedResult(
    orders.map((o) => o.toResponseObject()),
    total,
    options,
  );
};

const getAllOrders = async (
  query: OrderQuery,
): Promise<PaginatedResult<OrderResponse>> => {
  const options: PaginationOptions = parsePaginationQuery(query);
  const filter = buildFilterQuery(query);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ [options.sortBy]: options.sortOrder })
      .skip(options.skip)
      .limit(options.limit),
    Order.countDocuments(filter),
  ]);

  return buildPaginatedResult(
    orders.map((o) => o.toResponseObject()),
    total,
    options,
  );
};

const updateOrderStatus = async (
  orderId: string,
  dto: UpdateOrderStatusDTO,
): Promise<OrderResponse> => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new AppError('Invalid order ID.', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  // Enforce the state machine — only allow valid transitions
  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(dto.status)) {
    throw new AppError(
      `Cannot transition order from '${order.status}' to '${dto.status}'.`,
      422,
    );
  }

  order.status = dto.status;
  await order.save();

  eventBus.emit('order.statusChanged', {
    orderId: order._id.toString(),
    status: dto.status,
  });

  return order.toResponseObject();
};

const cancelOrder = async (
  orderId: string,
  requestingUserId: string,
  isAdmin: boolean,
): Promise<OrderResponse> => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new AppError('Invalid order ID.', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  // Non-admins can only cancel their own orders
  if (!isAdmin && order.userId.toString() !== requestingUserId) {
    throw new AppError('You do not have permission to cancel this order.', 403);
  }

  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(OrderStatus.CANCELLED)) {
    throw new AppError(
      `Order cannot be cancelled once it has reached '${order.status}' status.`,
      422,
    );
  }

  order.status = OrderStatus.CANCELLED;
  await order.save();

  eventBus.emit('order.statusChanged', {
    orderId: order._id.toString(),
    status: OrderStatus.CANCELLED,
  });

  return order.toResponseObject();
};

export const orderService = {
  placeOrder,
  getOrderById,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
};