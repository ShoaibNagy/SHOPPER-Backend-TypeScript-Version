import Stripe from 'stripe';
import { env } from './env';
import { logger } from '../shared/middleware/logger';

let stripeClient: Stripe | null = null;

const getClient = (): Stripe => {
  if (!stripeClient) {
    throw new Error('Stripe client not initialized. Call init() first.');
  }
  return stripeClient;
};

const init = (): void => {
  if (!env.stripe.secretKey) {
    logger.warn('Stripe secret key not configured. Payment routes will be unavailable.');
    return;
  }

  stripeClient = new Stripe(env.stripe.secretKey, {
    apiVersion: '2024-04-10',
    typescript: true,
  });

  logger.info('Stripe client initialized');
};

export const stripe = { init, getClient };