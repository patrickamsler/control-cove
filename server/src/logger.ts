import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import dotenv from 'dotenv';
dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';

const transports = [];
transports.push(new DailyRotateFile({
  filename: `${process.env.LOG_PATH || 'logs'}/%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxSize: '20m',
  maxFiles: '10d'
}));

if (isDevelopment) {
  transports.push(new winston.transports.Console());
}

const formatMeta = (meta: Record<string, unknown>): string => {
  const keys = Object.keys(meta);
  if (keys.length === 0) {
    return '';
  }
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ` [unserializable meta: ${keys.join(', ')}]`;
  }
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // Custom timestamp format
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `[${timestamp}] ${level.toUpperCase()}: [Server] ${message}${formatMeta(meta)}`;
      })),
  transports
});

export default logger;
