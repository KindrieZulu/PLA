/**
 * Global Error Handler Middleware
 * Centralized error handling with proper logging and user-friendly responses
 */

const logger = require('../config/logger');
const { errorsTotal } = require('../config/metrics');
const Sentry = require('@sentry/node');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// Development error response
const sendErrorDev = (err, req, res) => {
  // Log full error for debugging
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    userId: req.user?.id
  });

  res.status(err.statusCode || 500).json({
    error: err.name || 'Error',
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    stack: err.stack,
    requestId: req.id,
    ...(err.errors && { validationErrors: err.errors })
  });
};

// Production error response
const sendErrorProd = (err, req, res) => {
  // Log error
  if (err.isOperational) {
    logger.warn('Operational error', {
      code: err.code,
      message: err.message,
      url: req.originalUrl,
      userId: req.user?.id
    });
  } else {
    // Programming or unknown errors - log full details
    logger.error('Unexpected error', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    });

    // Send to Sentry for non-operational errors
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, {
        extra: {
          url: req.originalUrl,
          method: req.method,
          userId: req.user?.id
        }
      });
    }
  }

  // Send safe error response
  res.status(err.statusCode || 500).json({
    error: err.isOperational ? err.name : 'Internal Server Error',
    message: err.isOperational ? err.message : 'Something went wrong',
    code: err.code,
    requestId: req.id
  });
};

// Async handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Main error handler
const errorHandler = (err, req, res, next) => {
  // Default values
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_ERROR';

  // Track error in metrics
  errorsTotal.inc({
    type: err.statusCode >= 500 ? 'server_error' : 'client_error',
    code: err.statusCode.toString(),
    endpoint: req.path
  });

  // Handle specific error types
  if (err.name === 'ValidationError' && err.errors) {
    // Mongoose validation error
    err.statusCode = 400;
    err.message = 'Validation failed';
    err.code = 'VALIDATION_ERROR';
  }

  if (err.code === '23505') {
    // PostgreSQL unique violation
    err.statusCode = 409;
    err.message = 'Resource already exists';
    err.code = 'DUPLICATE_ENTRY';
  }

  if (err.code === '23503') {
    // PostgreSQL foreign key violation
    err.statusCode = 400;
    err.message = 'Referenced resource does not exist';
    err.code = 'FOREIGN_KEY_VIOLATION';
  }

  if (err.name === 'JsonWebTokenError') {
    err.statusCode = 401;
    err.message = 'Invalid token';
    err.code = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    err.statusCode = 401;
    err.message = 'Token has expired';
    err.code = 'TOKEN_EXPIRED';
  }

  // Send response based on environment
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    sendErrorDev(err, req, res);
  } else {
    sendErrorProd(err, req, res);
  }
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const err = new NotFoundError(`Route ${req.originalUrl}`);

  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
    requestId: req.id
  });
};

// Async error wrapper for route handlers
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  catchAsync,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError
};