import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './shared/middleware/errorHandler';
import { apiLimiter } from './shared/middleware/rateLimiter';
import { logger } from './shared/middleware/logger';

// Route imports — filled in as each module is built
import { authRouter } from './modules/auth/auth.routes';
import { productRouter } from './modules/products/product.routes';
// import { userRouter } from './modules/users/user.routes';
// import { orderRouter } from './modules/orders/order.routes';
// import { cartRouter } from './modules/cart/cart.routes';
// import { paymentRouter } from './modules/payments/payment.routes';
// import { reviewRouter } from './modules/reviews/review.routes';

export const createApp = (): Application => {
  const app = express();

  // ── Core middleware ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cors({
    origin: env.node.isDev ? '*' : process.env['ALLOWED_ORIGINS']?.split(',') ?? [],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'auth-token'],
  }));
  app.use(morgan(env.node.isDev ? 'dev' : 'combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));

  // ── Rate limiting ────────────────────────────────────────────────────────────
  app.use('/api', apiLimiter);

  // ── Static file serving ──────────────────────────────────────────────────────
  app.use('/images', express.static(path.join(process.cwd(), env.upload.dir)));

  // ── Health check ─────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Server is running',
      env: env.node.env,
      timestamp: new Date().toISOString(),
    });
  });

  // ── API routes ───────────────────────────────────────────────────────────────
  app.use('/api/auth', authRouter);
  app.use('/api/products', productRouter);
  // app.use('/api/users', userRouter);
  // app.use('/api/orders', orderRouter);
  // app.use('/api/cart', cartRouter);
  // app.use('/api/payments', paymentRouter);
  // app.use('/api/reviews', reviewRouter);

  // ── 404 handler ──────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // ── Global error handler (must be last) ──────────────────────────────────────
  app.use(errorHandler);

  return app;
};