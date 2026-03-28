import mongoose from 'mongoose';
import { userService } from '../../../src/modules/users/user.service';
import { User } from '../../../src/modules/users/user.model';
import { AppError } from '../../../src/shared/middleware/errorHandler';
import { UserRole } from '../../../src/modules/auth/auth.types';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/users/user.model');

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockId = new mongoose.Types.ObjectId().toString();

const mockUser = {
  _id: new mongoose.Types.ObjectId(mockId),
  username: 'testuser',
  email: 'test@example.com',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  comparePassword: jest.fn(),
  save: jest.fn(),
  toSafeObject: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('userService', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── getProfile ──────────────────────────────────────────────────────────────
  describe('getProfile', () => {
    it('returns user response for an active user', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.getProfile(mockId);

      expect(result.id).toBe(mockId);
      expect(result.email).toBe('test@example.com');
    });

    it('throws 404 when user does not exist', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(userService.getProfile(mockId)).rejects.toThrow(
        new AppError('User not found.', 404),
      );
    });

    it('throws 404 when user is inactive', async () => {
      (User.findById as jest.Mock).mockResolvedValue({ ...mockUser, isActive: false });

      await expect(userService.getProfile(mockId)).rejects.toThrow(
        new AppError('User not found.', 404),
      );
    });
  });

  // ── updateProfile ───────────────────────────────────────────────────────────
  describe('updateProfile', () => {
    it('updates and returns the user', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null); // no email conflict
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockUser,
        username: 'updateduser',
      });

      const result = await userService.updateProfile(mockId, { username: 'updateduser' });

      expect(result.username).toBe('updateduser');
    });

    it('throws 409 when new email is taken by another user', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({ ...mockUser, _id: new mongoose.Types.ObjectId() });

      await expect(
        userService.updateProfile(mockId, { email: 'taken@example.com' }),
      ).rejects.toThrow(new AppError('This email is already in use by another account.', 409));
    });

    it('throws 404 when user does not exist', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(
        userService.updateProfile(mockId, { username: 'newname' }),
      ).rejects.toThrow(new AppError('User not found.', 404));
    });
  });

  // ── changePassword ──────────────────────────────────────────────────────────
  describe('changePassword', () => {
    it('changes password when current password is correct', async () => {
      const userWithPassword = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(undefined),
      };
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithPassword),
      });

      await expect(
        userService.changePassword(mockId, {
          currentPassword: 'OldPass1',
          newPassword: 'NewPass1',
        }),
      ).resolves.toBeUndefined();

      expect(userWithPassword.save).toHaveBeenCalledTimes(1);
    });

    it('throws 401 when current password is wrong', async () => {
      const userWithPassword = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithPassword),
      });

      await expect(
        userService.changePassword(mockId, {
          currentPassword: 'WrongPass1',
          newPassword: 'NewPass1',
        }),
      ).rejects.toThrow(new AppError('Current password is incorrect.', 401));
    });

    it('throws 404 when user does not exist', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        userService.changePassword(mockId, {
          currentPassword: 'OldPass1',
          newPassword: 'NewPass1',
        }),
      ).rejects.toThrow(new AppError('User not found.', 404));
    });
  });

  // ── deactivateAccount ───────────────────────────────────────────────────────
  describe('deactivateAccount', () => {
    it('deactivates the account successfully', async () => {
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({ ...mockUser, isActive: false });

      await expect(userService.deactivateAccount(mockId)).resolves.toBeUndefined();
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockId,
        { $set: { isActive: false } },
        { new: true },
      );
    });

    it('throws 404 when user does not exist', async () => {
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(userService.deactivateAccount(mockId)).rejects.toThrow(
        new AppError('User not found.', 404),
      );
    });
  });

  // ── getUserById (admin) ─────────────────────────────────────────────────────
  describe('getUserById', () => {
    it('returns user for a valid id', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.getUserById(mockId);

      expect(result.id).toBe(mockId);
    });

    it('throws 400 for a malformed id', async () => {
      await expect(userService.getUserById('bad-id')).rejects.toThrow(
        new AppError('Invalid user ID.', 400),
      );
    });

    it('throws 404 when user does not exist', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(userService.getUserById(mockId)).rejects.toThrow(
        new AppError('User not found.', 404),
      );
    });
  });

  // ── adminUpdateUser ─────────────────────────────────────────────────────────
  describe('adminUpdateUser', () => {
    it('updates role and returns user', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: UserRole.ADMIN,
      });

      const result = await userService.adminUpdateUser(mockId, { role: UserRole.ADMIN });

      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('throws 400 for a malformed id', async () => {
      await expect(
        userService.adminUpdateUser('bad-id', { role: UserRole.ADMIN }),
      ).rejects.toThrow(new AppError('Invalid user ID.', 400));
    });
  });

  // ── adminDeleteUser ─────────────────────────────────────────────────────────
  describe('adminDeleteUser', () => {
    it('soft-deletes the user', async () => {
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({ ...mockUser, isActive: false });

      await expect(userService.adminDeleteUser(mockId)).resolves.toBeUndefined();
    });

    it('throws 404 when user does not exist', async () => {
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(userService.adminDeleteUser(mockId)).rejects.toThrow(
        new AppError('User not found.', 404),
      );
    });
  });
});