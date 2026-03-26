import winston from 'winston';
 
const { combine, timestamp, printf, colorize, errors } = winston.format;
 
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) => {
    return stack
      ? `[${ts as string}] ${level}: ${message as string}\n${stack as string}`
      : `[${ts as string}] ${level}: ${message as string}`;
  }),
);
 
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json(),
);
 
export const logger = winston.createLogger({
  level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'debug',
  format: process.env['NODE_ENV'] === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    ...(process.env['NODE_ENV'] === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});