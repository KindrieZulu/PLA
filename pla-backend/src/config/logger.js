/**
 * Winston Logger Configuration
 * Structured logging with multiple transports, levels, and formats
 */

const winston = require('winston');
const path = require('path');

// Custom format for structured logging (JSON for production, readable for development)
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  })
);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5
};

// Custom colors for development
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  trace: 'gray'
};

winston.addColors(colors);

// Create transports array
const createTransports = (env) => {
  const transports = [];

  // Console transport - always enabled
  if (env === 'development') {
    transports.push(
      new winston.transports.Console({
        level: 'debug',
        format: devFormat,
        handleExceptions: true
      })
    );
  } else {
    transports.push(
      new winston.transports.Console({
        level: 'info',
        format: structuredFormat,
        handleExceptions: true
      })
    );
  }

  // File transport for errors only - always enabled
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: structuredFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  );

  // File transport for all logs - production only
  if (env === 'production' || env === 'staging') {
    transports.push(
      new winston.transports.File({
        filename: path.join('logs', 'combined.log'),
        format: structuredFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 14, // Keep 2 weeks of logs
        tailable: true
      })
    );

    // Security audit log - separate file
    transports.push(
      new winston.transports.File({
        filename: path.join('logs', 'security.log'),
        format: structuredFormat,
        level: 'info',
        maxsize: 5242880, // 5MB
        maxFiles: 30,
        tailable: true
      })
    );
  }

  return transports;
};

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  defaultMeta: {
    service: 'pla-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid
  },
  transports: createTransports(process.env.NODE_ENV || 'development'),
  exitOnError: false
});

// Create a stream object for Morgan HTTP logging integration
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Security logging helper
logger.security = {
  login: (userId, username, ip, success) => {
    logger.info('Login attempt', {
      event: 'AUTH_LOGIN',
      userId,
      username,
      ip,
      success,
      timestamp: new Date().toISOString()
    });
  },
  logout: (userId, username, ip) => {
    logger.info('User logout', {
      event: 'AUTH_LOGOUT',
      userId,
      username,
      ip,
      timestamp: new Date().toISOString()
    });
  },
  tokenRefresh: (userId, ip) => {
    logger.info('Token refreshed', {
      event: 'AUTH_TOKEN_REFRESH',
      userId,
      ip,
      timestamp: new Date().toISOString()
    });
  },
  rateLimitExceeded: (ip, endpoint, userId) => {
    logger.warn('Rate limit exceeded', {
      event: 'RATE_LIMIT_EXCEEDED',
      ip,
      endpoint,
      userId,
      timestamp: new Date().toISOString()
    });
  },
  invalidToken: (ip, reason, userId) => {
    logger.warn('Invalid token attempt', {
      event: 'AUTH_INVALID_TOKEN',
      ip,
      reason,
      userId,
      timestamp: new Date().toISOString()
    });
  },
  failedAttempt: (username, ip, attemptNumber) => {
    logger.warn('Failed login attempt', {
      event: 'AUTH_FAILED_ATTEMPT',
      username,
      ip,
      attemptNumber,
      timestamp: new Date().toISOString()
    });
  },
  accountLocked: (username, ip, lockoutDuration) => {
    logger.warn('Account locked', {
      event: 'AUTH_ACCOUNT_LOCKED',
      username,
      ip,
      lockoutDuration,
      timestamp: new Date().toISOString()
    });
  },
  sensitiveOperation: (userId, operation, details) => {
    logger.info('Sensitive operation', {
      event: 'SENSITIVE_OPERATION',
      userId,
      operation,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = logger;