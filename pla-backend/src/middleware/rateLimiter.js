/**
 * Rate Limiter Middleware
 * Multiple rate limiters for different endpoint categories
 * Uses Redis for distributed rate limiting
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const logger = require('../config/logger');
const { rateLimitHitsTotal } = require('../config/metrics');

// Check if Redis is available
const isRedisAvailable = () => {
  try {
    const redis = require('../config/redis');
    return redis.redis.status === 'ready' || redis.redis.status === 'connect';
  } catch {
    return false;
  }
};

// Create Redis store options (only if Redis is available)
const createRedisStore = () => {
  try {
    const RedisStore = require('rate-limit-redis').default;
    const redis = require('../config/redis');
    return new RedisStore({
      sendCommand: (...args) => redis.redis.call(...args),
      prefix: 'rl:'
    });
  } catch (error) {
    return null;
  }
};

// Skip rate limiting for certain conditions
const skipRateLimit = (req) => {
  // Skip for health checks
  if (req.path === '/health' || req.path === '/metrics') {
    return true;
  }
  // Skip for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return true;
  }
  return false;
};

// Generic rate limiter factory
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipRateLimit,
    keyGenerator: (req) => {
      // Use X-Forwarded-For if behind proxy, otherwise use IP
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
      return ip;
    },
    handler: (req, res, next, options) => {
      const ip = req.ip || req.connection.remoteAddress;

      logger.security.rateLimitExceeded(ip, req.path, req.user?.id);

      // Track in metrics
      rateLimitHitsTotal.inc({
        endpoint: req.path,
        ip: ip.substring(0, 10) // Truncate for cardinality
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message,
        retryAfter: res.getHeader('Retry-After'),
        requestId: req.id
      });
    }
  };

  const config = { ...defaults, ...options };

  // Use Redis store if available, otherwise use memory store
  if (isRedisAvailable() && process.env.REDIS_HOST) {
    try {
      const redisStore = createRedisStore();
      if (redisStore) {
        config.store = redisStore;
        logger.info('Rate limiter using Redis store');
      } else {
        logger.warn('Redis store creation failed, using memory store');
      }
    } catch (error) {
      logger.warn('Redis store unavailable, falling back to memory store', {
        error: error.message
      });
    }
  } else {
    logger.info('Rate limiter using in-memory store (Redis unavailable)');
  }

  return rateLimit(config);
};

// Auth rate limiter (stricter)
const createAuthRateLimiter = (options = {}) => {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Only 10 auth attempts per window
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    skip: (req) => {
      // Always skip OPTIONS
      if (req.method === 'OPTIONS') return true;
      // Skip health checks
      if (req.path === '/health') return true;
      return false;
    },
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
      // Also include username/email for login attempts
      if (req.path.includes('login') && req.body?.username) {
        return `${ip}:${req.body.username}`;
      }
      return ip;
    }
  });
};

// Stricter rate limiter for sensitive operations
const createStricRateLimiter = (options = {}) => {
  return createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many requests. Please slow down.',
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
      return req.user?.id ? `${req.user.id}:${req.path}` : `${ip}:${req.path}`;
    }
  });
};

// Endpoint-specific rate limiters
const endpointLimiters = {
  // Quiz submission - moderate rate
  quiz: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many quiz submissions. Please wait.'
  }),

  // Mastery queries - higher rate
  mastery: createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many mastery requests.'
  }),

  // File uploads - very restrictive
  upload: createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many upload requests.'
  }),

  // Diagnostic tests - moderate
  diagnostic: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many diagnostic test submissions.'
  }),

  // Bulk operations - restrictive
  bulk: createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many bulk operations.'
  }),

  // Search queries
  search: createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many search requests.'
  }),

  // Read-heavy endpoints - generous
  read: createRateLimiter({
    windowMs: 60 * 1000,
    max: 120,
    message: 'Too many read requests.'
  })
};

// Brute force protection for login
const loginBruteForce = (() => {
  const attempts = new Map();
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 5;

  return {
    check: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const key = `login:${ip}`;
      const record = attempts.get(key);

      if (record && Date.now() < record.lockoutUntil) {
        return {
          allowed: false,
          remainingTime: Math.ceil((record.lockoutUntil - Date.now()) / 1000)
        };
      }

      if (record && record.attempts >= MAX_ATTEMPTS) {
        record.lockoutUntil = Date.now() + LOCKOUT_DURATION;
        logger.security.accountLocked('unknown', ip, LOCKOUT_DURATION / 1000);
        return {
          allowed: false,
          remainingTime: LOCKOUT_DURATION / 1000
        };
      }

      return { allowed: true };
    },

    recordFailure: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const key = `login:${ip}`;
      let record = attempts.get(key) || { attempts: 0, lockoutUntil: 0 };

      record.attempts += 1;
      attempts.set(key, record);

      logger.security.failedAttempt(req.body?.username || 'unknown', ip, record.attempts);

      if (record.attempts >= MAX_ATTEMPTS) {
        record.lockoutUntil = Date.now() + LOCKOUT_DURATION;
      }
    },

    recordSuccess: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const key = `login:${ip}`;
      attempts.delete(key);
    }
  };
})();

module.exports = {
  createRateLimiter,
  createAuthRateLimiter,
  createStricRateLimiter,
  endpointLimiters,
  loginBruteForce
};