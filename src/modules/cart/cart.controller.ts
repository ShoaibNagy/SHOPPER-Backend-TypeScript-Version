import { Request, Response } from 'express';
import { cartService } from './cart.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { ApiResponse } from '../../shared/types/common.types';
import {
  CartResponse,
  AddToCartDTO,
  RemoveFromCartDTO,
  UpdateCartItemDTO,
} from './cart.types';

// GET /api/cart
export const getCartHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cart = await cartService.getCart(req.user!.id);

    const response: ApiResponse<CartResponse> = {
      success: true,
      data: cart,
    };
    res.status(200).json(response);
  },
);

// POST /api/cart/items
export const addToCartHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: AddToCartDTO = {
      productId: req.body.productId as string,
      quantity: req.body.quantity !== undefined ? Number(req.body.quantity) : 1,
    };

    const cart = await cartService.addToCart(req.user!.id, dto);

    const response: ApiResponse<CartResponse> = {
      success: true,
      message: 'Item added to cart.',
      data: cart,
    };
    res.status(200).json(response);
  },
);

// DELETE /api/cart/items
export const removeFromCartHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: RemoveFromCartDTO = {
      productId: req.body.productId as string,
      quantity: req.body.quantity !== undefined ? Number(req.body.quantity) : 1,
    };

    const cart = await cartService.removeFromCart(req.user!.id, dto);

    const response: ApiResponse<CartResponse> = {
      success: true,
      message: 'Item removed from cart.',
      data: cart,
    };
    res.status(200).json(response);
  },
);

// PATCH /api/cart/items
export const updateCartItemHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: UpdateCartItemDTO = {
      productId: req.body.productId as string,
      quantity: Number(req.body.quantity),
    };

    const cart = await cartService.updateCartItem(req.user!.id, dto);

    const response: ApiResponse<CartResponse> = {
      success: true,
      message: 'Cart item updated.',
      data: cart,
    };
    res.status(200).json(response);
  },
);

// DELETE /api/cart
export const clearCartHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await cartService.clearCart(req.user!.id);

    const response: ApiResponse = {
      success: true,
      message: 'Cart cleared.',
    };
    res.status(200).json(response);
  },
);