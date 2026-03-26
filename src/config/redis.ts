import { createClient, RedisClientType } from 'redis';
import { env } from './env';
import { logger } from '../shared/middleware/logger';

let client: RedisClientType | null = null;

const getClient = (): RedisClientType => {
  if (!client) {
    throw new Error('Redis client not initialized. Call connect() first.');
  }
  return client;
};

const connect = async (): Promise<void> => {
  try {
    client = createClient({ url: env.redis.url }) as RedisClientType;

    client.on('error', (err: Error) => {
      logger.error('Redis client error:', err.message);
    });

    client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    await client.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    // Redis is optional — log but do not crash the server
    logger.warn('Redis connection failed. Rate limiting will fall back to memory store.', error);
    client = null;
  }
};

const disconnect = async (): Promise<void> => {
  if (client) {
    await client.disconnect();
    client = null;
    logger.info('Redis disconnected');
  }
};

export const redis = { connect, disconnect, getClient };