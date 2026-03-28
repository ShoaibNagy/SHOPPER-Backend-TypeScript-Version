import { Request, Response } from 'express';
import { userService } from './user.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { ApiResponse } from '../../shared/types/common.types';
import {
  UserResponse,
  UpdateProfileDTO,
  ChangePasswordDTO,
  AdminUpdateUserDTO,
  UserQuery,
} from './user.types';
import { UserRole } from '../auth/auth.types';

// ── Self-service handlers ─────────────────────────────────────────────────────

// GET /api/users/me
export const getProfileHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await userService.getProfile(req.user!.id);

    const response: ApiResponse<UserResponse> = {
      success: true,
      data: user,
    };
    res.status(200).json(response);
  },
);

// PATCH /api/users/me
export const updateProfileHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: UpdateProfileDTO = {};
    if (req.body.username !== undefined) dto.username = req.body.username as string;
    if (req.body.email !== undefined) dto.email = req.body.email as string;

    const user = await userService.updateProfile(req.user!.id, dto);

    const response: ApiResponse<UserResponse> = {
      success: true,
      message: 'Profile updated successfully.',
      data: user,
    };
    res.status(200).json(response);
  },
);

// PATCH /api/users/me/password
export const changePasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: ChangePasswordDTO = {
      currentPassword: req.body.currentPassword as string,
      newPassword: req.body.newPassword as string,
    };

    await userService.changePassword(req.user!.id, dto);

    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully.',
    };
    res.status(200).json(response);
  },
);

// DELETE /api/users/me
export const deactivateAccountHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await userService.deactivateAccount(req.user!.id);

    const response: ApiResponse = {
      success: true,
      message: 'Account deactivated successfully.',
    };
    res.status(200).json(response);
  },
);

// ── Admin handlers ────────────────────────────────────────────────────────────

// GET /api/users
export const getAllUsersHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query: UserQuery = {
      page: req.query['page'] ? Number(req.query['page']) : undefined,
      limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
      sortBy: req.query['sortBy'] as string | undefined,
      sortOrder: req.query['sortOrder'] as 'asc' | 'desc' | undefined,
      search: req.query['search'] as string | undefined,
      role: req.query['role'] as UserRole | undefined,
      isActive: req.query['isActive'] !== undefined
        ? req.query['isActive'] === 'true'
        : undefined,
    };

    const result = await userService.getAllUsers(query);
    res.status(200).json({ success: true, ...result });
  },
);

// GET /api/users/:id
export const getUserByIdHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await userService.getUserById(req.params['id'] as string);

    const response: ApiResponse<UserResponse> = {
      success: true,
      data: user,
    };
    res.status(200).json(response);
  },
);

// PATCH /api/users/:id
export const adminUpdateUserHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dto: AdminUpdateUserDTO = {};
    if (req.body.username !== undefined) dto.username = req.body.username as string;
    if (req.body.email !== undefined) dto.email = req.body.email as string;
    if (req.body.role !== undefined) dto.role = req.body.role as UserRole;
    if (req.body.isActive !== undefined) dto.isActive = Boolean(req.body.isActive);

    const user = await userService.adminUpdateUser(req.params['id'] as string, dto);

    const response: ApiResponse<UserResponse> = {
      success: true,
      message: 'User updated successfully.',
      data: user,
    };
    res.status(200).json(response);
  },
);

// DELETE /api/users/:id
export const adminDeleteUserHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await userService.adminDeleteUser(req.params['id'] as string);

    const response: ApiResponse = {
      success: true,
      message: 'User deactivated successfully.',
    };
    res.status(200).json(response);
  },
);