import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { User } from '../../../src/modules/users/user.model';
import { UserRole } from '../../../src/modules/auth/auth.types';
import { authLimiter } from '../../../src/shared/middleware/rateLimiter';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/config/env', () => ({
  env: {
    node: { env: 'test', isDev: false, isProd: false, port: 4000 },
    jwt: { secret: 'test-secret-32-chars-minimum-len', expiresIn: '7d' },
    bcrypt: { saltRounds: 10 },
    upload: { dir: 'upload/images', maxFileSizeMb: 5 },
    redis: { url: '' },
    stripe: { secretKey: '' },
  },
}));

const app = createApp();

// ── Token helpers ─────────────────────────────────────────────────────────────
const SECRET = 'test-secret-32-chars-minimum-len';

const makeToken = (role: UserRole, id = 'user-id-123') =>
  jwt.sign({ id, email: 'test@example.com', role }, SECRET, { expiresIn: '1h' });

const userToken  = makeToken(UserRole.USER);
const adminToken = makeToken(UserRole.ADMIN, 'admin-id-456');

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockId = new mongoose.Types.ObjectId().toString();

const mockUserDoc = {
  _id: new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'),
  username: 'testuser',
  email: 'test@example.com',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  comparePassword: jest.fn(),
  save: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('User routes', () => {

  beforeEach(async () => {
    jest.clearAllMocks();
    await authLimiter.resetKey('::ffff:127.0.0.1');
  });

  // ── GET /api/users/me ───────────────────────────────────────────────────────
  describe('GET /api/users/me', () => {
    it('returns 200 with user profile for authenticated user', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUserDoc);

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /api/users/me ─────────────────────────────────────────────────────
  describe('PATCH /api/users/me', () => {
    it('returns 200 on a valid profile update', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockUserDoc,
        username: 'updateduser',
      });

      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ username: 'updateduser' });

      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('updateduser');
    });

    it('returns 422 for an invalid email', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for a username that is too short', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ username: 'ab' });

      expect(res.status).toBe(422);
    });
  });

  // ── PATCH /api/users/me/password ────────────────────────────────────────────
  describe('PATCH /api/users/me/password', () => {
    it('returns 200 on a successful password change', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUserDoc,
          comparePassword: jest.fn().mockResolvedValue(true),
          save: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: 'OldPass1', newPassword: 'NewPass1' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password changed successfully.');
    });

    it('returns 422 when new password is too weak', async () => {
      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: 'OldPass1', newPassword: 'weak' });

      expect(res.status).toBe(422);
    });

    it('returns 422 when new password matches current password', async () => {
      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: 'SamePass1', newPassword: 'SamePass1' });

      expect(res.status).toBe(422);
    });

    it('returns 401 when current password is wrong', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUserDoc,
          comparePassword: jest.fn().mockResolvedValue(false),
        }),
      });

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: 'WrongPass1', newPassword: 'NewPass1' });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/users/me ────────────────────────────────────────────────────
  describe('DELETE /api/users/me', () => {
    it('returns 200 on successful deactivation', async () => {
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockUserDoc,
        isActive: false,
      });

      const res = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Account deactivated successfully.');
    });
  });

  // ── GET /api/users (admin) ──────────────────────────────────────────────────
  describe('GET /api/users', () => {
    it('returns 200 with paginated users for admin', async () => {
      (User.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserDoc]),
      });
      (User.countDocuments as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 403 for a regular user', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /api/users/:id (admin) ────────────────────────────────────────────
  describe('PATCH /api/users/:id', () => {
    it('returns 200 when admin updates a user role', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockUserDoc,
        role: UserRole.ADMIN,
      });

      const res = await request(app)
        .patch(`/api/users/${mockId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.ADMIN });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(UserRole.ADMIN);
    });

    it('returns 422 for an invalid role', async () => {
      const res = await request(app)
        .patch(`/api/users/${mockId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' });

      expect(res.status).toBe(422);
    });

    it('returns 403 for a regular user', async () => {
      const res = await request(app)
        .patch(`/api/users/${mockId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: UserRole.ADMIN });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/users/:id (admin) ───────────────────────────────────────────
  describe('DELETE /api/users/:id', () => {
    it('returns 200 when admin deactivates a user', async () => {
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockUserDoc,
        isActive: false,
      });

      const res = await request(app)
        .delete(`/api/users/${mockId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 422 for a malformed user id', async () => {
      const res = await request(app)
        .delete('/api/users/not-an-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
    });

    it('returns 403 for a regular user', async () => {
      const res = await request(app)
        .delete(`/api/users/${mockId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});