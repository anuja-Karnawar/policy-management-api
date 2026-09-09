
const logger = require('./logger.config');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // marks this as an error we anticipated, not a crash
    Error.captureStackTrace(this, this.constructor);
  }
}


function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;


  logger.error(`${req.method} ${req.originalUrl} -> ${err.message}`, {
    stack: err.stack
  });

  res.status(statusCode).json({
    success: false,
    message: err.isOperational ? err.message : 'Something went wrong on our end',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { AppError, notFoundHandler, errorHandler, asyncHandler };
