const { createLogger, format, transports } = require('winston');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');

const logFormat = format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }), 
    logFormat
  ),
  transports: [
    new transports.File({ filename: path.join(LOG_DIR, 'combined.log') }),
    new transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' })
  ]
});


if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple())
    })
  );
}

module.exports = logger;
