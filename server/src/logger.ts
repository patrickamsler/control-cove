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

const logger = winston.createLogger({
  level: 'info', // Default log level
  format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // Custom timestamp format
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level.toUpperCase()}: [Server] ${message}`;
      })),
  transports
});

export default logger;