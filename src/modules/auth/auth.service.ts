import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { User } from '../users/user.model';
import { AppError } from '../../shared/middleware/errorHandler';
import { eventBus } from '../../shared/events/eventBus';
import { logger } from '../../shared/middleware/logger';
import {
  ITokenPayload,
  LoginDTO,
  SignupDTO,
  AuthResponse,
  UserRole,
} from './auth.types';

// ── Token helpers ────────────────────────────────────────────────────────────

const signToken = (payload: ITokenPayload): string => {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): ITokenPayload => {
  try {
    return jwt.verify(token, env.jwt.secret) as ITokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Token has expired. Please log in again.', 401);
    }
    throw new AppError('Invalid token. Please log in again.', 401);
  }
};

// ── Auth operations ──────────────────────────────────────────────────────────

export const signup = async (dto: SignupDTO): Promise<AuthResponse> => {
  // 1. Check for duplicate email
  const existing = await User.findOne({ email: dto.email.toLowerCase() });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  // 2. Create user — password is hashed by the pre-save hook in user.model.ts
  const user = await User.create({
    username: dto.username,
    email: dto.email,
    password: dto.password,
    role: UserRole.USER,
  });

  // 3. Emit domain event (triggers welcome email listener, etc.)
  eventBus.emit('user.registered', {
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
  });

  logger.info(`New user registered: ${user.email}`);

  // 4. Issue token
  const payload: ITokenPayload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  return {
    token: signToken(payload),
    user: user.toSafeObject(),
  };
};

export const login = async (dto: LoginDTO): Promise<AuthResponse> => {
  // 1. Find user — password field is excluded by default, select it explicitly
  const user = await User.findOne({ email: dto.email.toLowerCase() }).select('+password');
  if (!user) {
    // Deliberately vague: don't reveal whether the email exists
    throw new AppError('Invalid email or password.', 401);
  }

  // 2. Check account is active
  if (!user.isActive) {
    throw new AppError('This account has been deactivated. Please contact support.', 403);
  }

  // 3. Compare password using bcrypt
  const isMatch = await user.comparePassword(dto.password);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  logger.info(`User logged in: ${user.email}`);

  // 4. Issue token
  const payload: ITokenPayload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  return {
    token: signToken(payload),
    user: user.toSafeObject(),
  };
};

export const refreshToken = async (oldToken: string): Promise<{ token: string }> => {
  const payload = verifyToken(oldToken);

  // Ensure user still exists and is active
  const user = await User.findById(payload.id);
  if (!user || !user.isActive) {
    throw new AppError('User not found or deactivated.', 401);
  }

  const newPayload: ITokenPayload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  return { token: signToken(newPayload) };
};

export const authService = { signup, login, refreshToken, verifyToken };