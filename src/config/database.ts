import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../shared/middleware/logger';
 
const MONGO_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};
 
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
 
let retryCount = 0;
 
const connect = async (): Promise<void> => {
  try {
    await mongoose.connect(env.db.uri, MONGO_OPTIONS);
    logger.info('MongoDB connected successfully');
    retryCount = 0;
  } catch (error) {
    retryCount += 1;
    logger.error(`MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);
 
    if (retryCount >= MAX_RETRIES) {
      logger.error('Max MongoDB connection retries reached. Shutting down.');
      process.exit(1);
    }
 
    logger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
    setTimeout(() => {
      void connect();
    }, RETRY_DELAY_MS);
  }
};
 
const disconnect = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};
 
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost. Attempting reconnect...');
  void connect();
});
 
mongoose.connection.on('error', (err: Error) => {
  logger.error('MongoDB runtime error:', err.message);
});
 
export const db = { connect, disconnect };