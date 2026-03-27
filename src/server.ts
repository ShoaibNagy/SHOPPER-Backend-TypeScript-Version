import { createApp } from './app';
import { db } from './config/database';
import { redis } from './config/redis';
import { stripe } from './config/stripe';
import { env } from './config/env';
import { logger } from './shared/middleware/logger';

const bootstrap = async (): Promise<void> => {
  // Connect to services
  await db.connect();
  await redis.connect();
  stripe.init();

  // Start HTTP server
  const app = createApp();
  const server = app.listen(env.node.port, () => {
    logger.info(`Server running on port ${env.node.port} in ${env.node.env} mode`);
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await db.disconnect();
      await redis.disconnect();
      logger.info('All connections closed. Exiting.');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
    void shutdown('unhandledRejection');
  });
};

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});