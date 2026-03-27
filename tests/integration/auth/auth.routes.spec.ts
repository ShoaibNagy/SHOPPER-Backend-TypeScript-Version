import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../../src/app';
import { User } from '../../../src/modules/users/user.model';

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/users/user.model');
jest.mock('../../../src/config/env', () => ({
  env: {
    node: { env: 'test', isDev: false, isProd: false, port: 4000 },
    jwt: { secret: 'test-secret-32-chars-minimum-len', expiresIn: '7d' },
    bcrypt: { saltRounds: 10 },
    upload: { dir: 'upload/images' },
    redis: { url: '' },
    stripe: { secretKey: '' },
  },
}));
jest.mock('../../../src/shared/events/eventBus', () => ({
  eventBus: { emit: jest.fn() },
}));

const app = createApp();

// ── Fixtures ─────────────────────────────────────────────────────────────────
const validSignup = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password1',
};

const mockSavedUser = {
  _id: new mongoose.Types.ObjectId(),
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  isActive: true,
  createdAt: new Date(),
  comparePassword: jest.fn().mockResolvedValue(true),
  toSafeObject: jest.fn().mockReturnValue({
    id: 'user-id-123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    isActive: true,
    createdAt: new Date(),
  }),
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Auth routes', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── POST /api/auth/signup ───────────────────────────────────────────────────
  describe('POST /api/auth/signup', () => {
    it('returns 201 and a token on valid signup', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(mockSavedUser);

      const res = await request(app).post('/api/auth/signup').send(validSignup);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('returns 422 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com' }); // missing username and password

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 for a weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validSignup, password: 'weak' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validSignup, email: 'not-an-email' });

      expect(res.status).toBe(422);
    });

    it('returns 409 when email is already taken', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(mockSavedUser);

      const res = await request(app).post('/api/auth/signup').send(validSignup);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /api/auth/login ────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('returns 200 and a token on valid credentials', async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockSavedUser),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('returns 401 on wrong password', async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockSavedUser,
          comparePassword: jest.fn().mockResolvedValue(false),
        }),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPass1' });

      expect(res.status).toBe(401);
    });

    it('returns 422 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password1' });

      expect(res.status).toBe(422);
    });
  });

  // ── GET /api/auth/me ────────────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer fake.token.here');

      expect(res.status).toBe(401);
    });

    it('returns 200 and user payload for a valid token', async () => {
      // Get a real token by signing up first
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(mockSavedUser);

      const signupRes = await request(app).post('/api/auth/signup').send(validSignup);
      const token = signupRes.body.data.token as string;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('test@example.com');
    });
  });
});