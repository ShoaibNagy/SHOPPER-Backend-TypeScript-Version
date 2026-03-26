import dotenv from 'dotenv';
import path from 'path';
 
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
 
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};
 
const optionalEnv = (key: string, fallback: string): string => {
  return process.env[key] ?? fallback;
};
 
export const env = {
  node: {
    env: optionalEnv('NODE_ENV', 'development'),
    port: parseInt(optionalEnv('PORT', '4000'), 10),
    isDev: optionalEnv('NODE_ENV', 'development') === 'development',
    isProd: process.env['NODE_ENV'] === 'production',
  },
 
  db: {
    username: requireEnv('MONGODB_USERNAME'),
    password: requireEnv('MONGODB_PASSWORD'),
    cluster: requireEnv('MONGODB_CLUSTER'),
    appName: optionalEnv('MONGODB_APP_NAME', 'Cluster0'),
    get uri(): string {
      return `mongodb+srv://${this.username}:${this.password}@${this.cluster}/?retryWrites=true&w=majority&appName=${this.appName}`;
    },
  },
 
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '7d'),
  },
 
  bcrypt: {
    saltRounds: parseInt(optionalEnv('BCRYPT_SALT_ROUNDS', '12'), 10),
  },
 
  stripe: {
    secretKey: optionalEnv('STRIPE_SECRET_KEY', ''),
    webhookSecret: optionalEnv('STRIPE_WEBHOOK_SECRET', ''),
  },
 
  redis: {
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
  },
 
  upload: {
    dir: optionalEnv('UPLOAD_DIR', 'upload/images'),
    maxFileSizeMb: parseInt(optionalEnv('MAX_FILE_SIZE_MB', '5'), 10),
  },
} as const;
 
export type Env = typeof env;