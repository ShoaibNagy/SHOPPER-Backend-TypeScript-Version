import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { verifyToken } from './auth.service';
import { UserRole } from './auth.types';

// ── Authentication guard ─────────────────────────────────────────────────────
// Verifies the JWT and attaches the decoded payload to req.user.
// Accepts the token from the Authorization header (Bearer) or the legacy
// auth-token header used in the prototype, for backwards compatibility.

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    let token: string | undefined;

    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      // Legacy header support (prototype used 'auth-token')
      const legacyHeader = req.headers['auth-token'];
      if (typeof legacyHeader === 'string') {
        token = legacyHeader;
      }
    }

    if (!token) {
      throw new AppError('No authentication token provided.', 401);
    }

    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

// ── Role-based access control ────────────────────────────────────────────────
// Usage: router.delete('/product/:id', authenticate, authorize(UserRole.ADMIN), handler)

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Not authenticated.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403),
      );
    }

    next();
  };
};

// ── Optional authentication ──────────────────────────────────────────────────
// Attaches req.user if a token is present but does NOT block the request
// if there is no token — useful for public routes that have richer
// responses for authenticated users (e.g. personalised product listings).

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (token) {
      req.user = verifyToken(token);
    }
  } catch {
    // Silently ignore invalid tokens on optional routes
  }
  next();
};