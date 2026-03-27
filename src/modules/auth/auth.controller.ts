import { Request, Response } from 'express';
import { authService } from './auth.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { ApiResponse } from '../../shared/types/common.types';
import { AuthResponse, LoginDTO, SignupDTO } from './auth.types';

// POST /api/auth/signup
export const signupHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const dto: SignupDTO = {
    username: req.body.username as string,
    email: req.body.email as string,
    password: req.body.password as string,
  };

  const result = await authService.signup(dto);

  const response: ApiResponse<AuthResponse> = {
    success: true,
    message: 'Account created successfully.',
    data: result,
  };

  res.status(201).json(response);
});

// POST /api/auth/login
export const loginHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const dto: LoginDTO = {
    email: req.body.email as string,
    password: req.body.password as string,
  };

  const result = await authService.login(dto);

  const response: ApiResponse<AuthResponse> = {
    success: true,
    message: 'Logged in successfully.',
    data: result,
  };

  res.status(200).json(response);
});

// POST /api/auth/refresh
export const refreshTokenHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      res.status(401).json({ success: false, message: 'No token provided.' });
      return;
    }

    const result = await authService.refreshToken(token);

    const response: ApiResponse<{ token: string }> = {
      success: true,
      message: 'Token refreshed.',
      data: result,
    };

    res.status(200).json(response);
  },
);

// GET /api/auth/me  (requires authenticate middleware)
export const getMeHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<typeof req.user> = {
    success: true,
    data: req.user,
  };

  res.status(200).json(response);
});