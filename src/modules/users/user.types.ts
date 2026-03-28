import { UserRole } from '../auth/auth.types';

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileDTO {
  username?: string;
  email?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface AdminUpdateUserDTO {
  username?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}