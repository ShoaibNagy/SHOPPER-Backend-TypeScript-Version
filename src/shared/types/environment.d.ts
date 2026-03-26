declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    MONGODB_USERNAME: string;
    MONGODB_PASSWORD: string;
    MONGODB_CLUSTER: string;
    MONGODB_APP_NAME?: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN?: string;
    BCRYPT_SALT_ROUNDS?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    REDIS_URL?: string;
    UPLOAD_DIR?: string;
    MAX_FILE_SIZE_MB?: string;
  }
}