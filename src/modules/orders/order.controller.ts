import { Request, Response } from 'express';
import { orderService } from './order.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { ApiResponse } from '../../shared/types/common.types';
import { UserRole } from '../auth/auth.types';
import {
  OrderResponse,
  PlaceOrderDTO,
  UpdateOrderStatusDTO,
  OrderQuery,
  OrderStatus,
} from './order.types';

// POST /api/orders
export const placeOrderHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: PlaceOrderDTO = {
      shippingAddress: req.body.shippingAddress as PlaceOrderDTO['shippingAddress'],
    };

    const order = await orderService.placeOrder(req.user!.id, dto);

    const response: ApiResponse<OrderResponse> = {
      success: true,
      message: 'Order placed successfully.',
      data: order,
    };
    res.status(201).json(response);
  },
);

// GET /api/orders/my
export const getMyOrdersHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query: OrderQuery = {
      page:      req.query['page'] ? Number(req.query['page']) : undefined,
      limit:     req.query['limit'] ? Number(req.query['limit']) : undefined,
      sortBy:    req.query['sortBy'] as string | undefined,
      sortOrder: req.query['sortOrder'] as 'asc' | 'desc' | undefined,
      status:    req.query['status'] as OrderStatus | undefined,
    };

    const result = await orderService.getMyOrders(req.user!.id, query);
    res.status(200).json({ success: true, ...result });
  },
);

// GET /api/orders/:id
export const getOrderByIdHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const order = await orderService.getOrderById(
      req.params['id'] as string,
      req.user!.id,
      isAdmin,
    );

    const response: ApiResponse<OrderResponse> = {
      success: true,
      data: order,
    };
    res.status(200).json(response);
  },
);

// GET /api/orders  (admin)
export const getAllOrdersHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query: OrderQuery = {
      page:      req.query['page'] ? Number(req.query['page']) : undefined,
      limit:     req.query['limit'] ? Number(req.query['limit']) : undefined,
      sortBy:    req.query['sortBy'] as string | undefined,
      sortOrder: req.query['sortOrder'] as 'asc' | 'desc' | undefined,
      status:    req.query['status'] as OrderStatus | undefined,
      userId:    req.query['userId'] as string | undefined,
    };

    const result = await orderService.getAllOrders(query);
    res.status(200).json({ success: true, ...result });
  },
);

// PATCH /api/orders/:id/status  (admin)
export const updateOrderStatusHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: UpdateOrderStatusDTO = {
      status: req.body.status as OrderStatus,
    };

    const order = await orderService.updateOrderStatus(
      req.params['id'] as string,
      dto,
    );

    const response: ApiResponse<OrderResponse> = {
      success: true,
      message: `Order status updated to '${dto.status}'.`,
      data: order,
    };
    res.status(200).json(response);
  },
);

// DELETE /api/orders/:id/cancel
export const cancelOrderHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const order = await orderService.cancelOrder(
      req.params['id'] as string,
      req.user!.id,
      isAdmin,
    );

    const response: ApiResponse<OrderResponse> = {
      success: true,
      message: 'Order cancelled successfully.',
      data: order,
    };
    res.status(200).json(response);
  },
);