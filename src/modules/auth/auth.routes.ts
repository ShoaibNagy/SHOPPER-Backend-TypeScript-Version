import { Router } from 'express';
import { signupHandler, loginHandler, refreshTokenHandler, getMeHandler } from './auth.controller';
import { authenticate } from './auth.middleware';
import { authLimiter } from '../../shared/middleware/rateLimiter';
import { signupValidators, loginValidators, validate } from '../../shared/utils/validators';

const router = Router();

// All auth routes get the strict rate limiter (10 req / 15 min)
router.use(authLimiter);

/**
 * @route  POST /api/auth/signup
 * @access Public
 */
router.post('/signup', signupValidators, validate, signupHandler);

/**
 * @route  POST /api/auth/login
 * @access Public
 */
router.post('/login', loginValidators, validate, loginHandler);

/**
 * @route  POST /api/auth/refresh
 * @access Public (valid but possibly expiring token required)
 */
router.post('/refresh', refreshTokenHandler);

/**
 * @route  GET /api/auth/me
 * @access Private
 */
router.get('/me', authenticate, getMeHandler);

export { router as authRouter };