import jwt from 'jsonwebtoken';
import { signup, login, refreshToken, verifyToken } from '../../../src/modules/auth/auth.service';
import { User } from '../../../src/modules/users/user.model';
import { AppError } from '../../../src/shared/middleware/errorHandler';
import { UserRole } from '../../../src/modules/auth/auth.types';
import { eventBus } from '../../../src/shared/events/eventBus';

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/shared/events/eventBus', () => ({
  eventBus: { emit: jest.fn() },
}));
jest.mock('../../../src/config/env', () => ({
  env: {
    jwt: { secret: 'test-secret-32-chars-minimum-len', expiresIn: '7d' },
    bcrypt: { saltRounds: 10 },
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const mockUser = {
  _id: { toString: () => 'user-id-123' },
  username: 'testuser',
  email: 'test@example.com',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date(),
  comparePassword: jest.fn(),
  toSafeObject: jest.fn().mockReturnValue({
    id: 'user-id-123',
    username: 'testuser',
    email: 'test@example.com',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date(),
  }),
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('authService', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── signup ──────────────────────────────────────────────────────────────────
  describe('signup', () => {
    it('creates a user and returns a token when email is unique', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await signup({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password1',
      });

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(eventBus.emit).toHaveBeenCalledWith('user.registered', expect.objectContaining({
        email: 'test@example.com',
      }));
    });

    it('throws 409 when email is already registered', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        signup({ username: 'testuser', email: 'test@example.com', password: 'Password1' }),
      ).rejects.toThrow(new AppError('An account with this email already exists.', 409));
    });
  });

  // ── login ───────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns a token on valid credentials', async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ ...mockUser, comparePassword: jest.fn().mockResolvedValue(true) }),
      });

      const result = await login({ email: 'test@example.com', password: 'Password1' });

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('throws 401 when user does not exist', async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        login({ email: 'ghost@example.com', password: 'Password1' }),
      ).rejects.toThrow(new AppError('Invalid email or password.', 401));
    });

    it('throws 401 on wrong password', async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          comparePassword: jest.fn().mockResolvedValue(false),
        }),
      });

      await expect(
        login({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(new AppError('Invalid email or password.', 401));
    });

    it('throws 403 when account is deactivated', async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ ...mockUser, isActive: false }),
      });

      await expect(
        login({ email: 'test@example.com', password: 'Password1' }),
      ).rejects.toThrow(new AppError('This account has been deactivated. Please contact support.', 403));
    });
  });

  // ── verifyToken ─────────────────────────────────────────────────────────────
  describe('verifyToken', () => {
    const secret = 'test-secret-32-chars-minimum-len';

    it('returns decoded payload for a valid token', () => {
      const payload = { id: 'user-id-123', email: 'test@example.com', role: UserRole.USER };
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });

      const result = verifyToken(token);

      expect(result.id).toBe('user-id-123');
      expect(result.email).toBe('test@example.com');
    });

    it('throws 401 for an expired token', () => {
      const payload = { id: 'user-id-123', email: 'test@example.com', role: UserRole.USER };
      const token = jwt.sign(payload, secret, { expiresIn: '0s' });

      expect(() => verifyToken(token)).toThrow(
        new AppError('Token has expired. Please log in again.', 401),
      );
    });

    it('throws 401 for a tampered token', () => {
      expect(() => verifyToken('totally.fake.token')).toThrow(
        new AppError('Invalid token. Please log in again.', 401),
      );
    });
  });

  // ── refreshToken ────────────────────────────────────────────────────────────
  describe('refreshToken', () => {
    const secret = 'test-secret-32-chars-minimum-len';

    it('issues a new token for an active user', async () => {
      const payload = { id: 'user-id-123', email: 'test@example.com', role: UserRole.USER };
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await refreshToken(token);

      expect(result.token).toBeDefined();
      expect(result.token).not.toBe(token);
    });

    it('throws 401 if user is not found', async () => {
      const payload = { id: 'user-id-123', email: 'test@example.com', role: UserRole.USER };
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });

      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(refreshToken(token)).rejects.toThrow(
        new AppError('User not found or deactivated.', 401),
      );
    });
  });
});