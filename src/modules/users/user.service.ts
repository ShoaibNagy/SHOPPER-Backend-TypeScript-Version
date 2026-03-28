import mongoose from 'mongoose';
import { User, IUser } from './user.model';
import { AppError } from '../../shared/middleware/errorHandler';
import { parsePaginationQuery, buildPaginatedResult, PaginationOptions } from '../../shared/utils/pagination';
import { PaginatedResult } from '../../shared/types/common.types';
import {
  UserResponse,
  UpdateProfileDTO,
  ChangePasswordDTO,
  AdminUpdateUserDTO,
  UserQuery,
} from './user.types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const toUserResponse = (user: IUser): UserResponse => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildFilterQuery = (query: UserQuery): mongoose.FilterQuery<IUser> => {
  const filter: mongoose.FilterQuery<IUser> = {};

  if (query.role) filter['role'] = query.role;
  if (query.isActive !== undefined) filter['isActive'] = query.isActive;
  if (query.search) {
    filter['$or'] = [
      { username: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  return filter;
};

// ── Service operations ────────────────────────────────────────────────────────

const getProfile = async (userId: string): Promise<UserResponse> => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }
  return toUserResponse(user);
};

const updateProfile = async (
  userId: string,
  dto: UpdateProfileDTO,
): Promise<UserResponse> => {
  // Guard: email uniqueness check if email is being changed
  if (dto.email) {
    const existing = await User.findOne({
      email: dto.email.toLowerCase(),
      _id: { $ne: new mongoose.Types.ObjectId(userId) },
    });
    if (existing) {
      throw new AppError('This email is already in use by another account.', 409);
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: dto },
    { new: true, runValidators: true },
  );

  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  return toUserResponse(user);
};

const changePassword = async (
  userId: string,
  dto: ChangePasswordDTO,
): Promise<void> => {
  const user = await User.findById(userId).select('+password');
  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  const isMatch = await user.comparePassword(dto.currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect.', 401);
  }

  // Assign new password — pre-save hook re-hashes it automatically
  user.password = dto.newPassword;
  await user.save();
};

const deactivateAccount = async (userId: string): Promise<void> => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { isActive: false } },
    { new: true },
  );

  if (!user) {
    throw new AppError('User not found.', 404);
  }
};

// ── Admin-only operations ─────────────────────────────────────────────────────

const getAllUsers = async (
  query: UserQuery,
): Promise<PaginatedResult<UserResponse>> => {
  const options: PaginationOptions = parsePaginationQuery(query);
  const filter = buildFilterQuery(query);

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ [options.sortBy]: options.sortOrder })
      .skip(options.skip)
      .limit(options.limit),
    User.countDocuments(filter),
  ]);

  return buildPaginatedResult(users.map(toUserResponse), total, options);
};

const getUserById = async (userId: string): Promise<UserResponse> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID.', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return toUserResponse(user);
};

const adminUpdateUser = async (
  userId: string,
  dto: AdminUpdateUserDTO,
): Promise<UserResponse> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID.', 400);
  }

  // Guard: email uniqueness check
  if (dto.email) {
    const existing = await User.findOne({
      email: dto.email.toLowerCase(),
      _id: { $ne: new mongoose.Types.ObjectId(userId) },
    });
    if (existing) {
      throw new AppError('This email is already in use by another account.', 409);
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: dto },
    { new: true, runValidators: true },
  );

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return toUserResponse(user);
};

const adminDeleteUser = async (userId: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID.', 400);
  }

  // Soft-delete: deactivate rather than hard-delete to preserve
  // referential integrity with existing orders and reviews
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { isActive: false } },
    { new: true },
  );

  if (!user) {
    throw new AppError('User not found.', 404);
  }
};

export const userService = {
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount,
  getAllUsers,
  getUserById,
  adminUpdateUser,
  adminDeleteUser,
};