/**
 * Redis Configuration
 * Connection with support for caching, rate limiting, and sessions
 */

const Redis = require('ioredis');
const logger = require('./logger');

// Build Redis options
const buildRedisOptions = () => {
  const host = process.env.REDIS_HOST || process.env.DOCKER_REDIS_HOST;
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);

  // If no Redis host configured, return null to skip connection
  if (!host || host === '' || host === 'undefined') {
    return null;
  }

  const options = {
    host,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    enableReadyCheck: false,
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: null, // Don't fail on command if Redis unavailable
    retryStrategy: (times) => {
      if (times > 3) return null; // Stop after 3 retries
      return Math.min(times * 100, 1000);
    },
    // Disable auto-reconnect to prevent hanging
    reconnectOnError: () => false
  };

  if (process.env.REDIS_TLS === 'true') {
    options.tls = {
      rejectUnauthorized: false
    };
  }

  return options;
};

// Create Redis client
const redisOptions = buildRedisOptions();

// If no Redis configured, create a dummy that doesn't connect
let redis;
if (!redisOptions) {
  // Create a minimal mock that won't crash on property access
  const EventEmitter = require('events');
  const mockRedis = new EventEmitter();
  mockRedis.status = 'disabled';
  mockRedis.connect = async () => { throw new Error('Redis not configured'); };
  mockRedis.ping = async () => { throw new Error('Redis not configured'); };
  mockRedis.quit = async () => {};
  mockRedis.disconnect = () => {};
  mockRedis.call = async () => { throw new Error('Redis not configured'); };
  redis = mockRedis;
} else {
  redisOptions.maxRetriesPerRequest = null;
  redisOptions.retryStrategy = (times) => {
    if (times > 3) return null;
    return Math.min(times * 100, 2000);
  };
  redis = new Redis(redisOptions);
}

// Event handlers
redis.on('connect', () => {
  logger.info('Redis connecting...', {
    host: redis.options.host,
    port: redis.options.port
  });
});

redis.on('ready', () => {
  logger.info('Redis connected and ready', {
    host: redis.options.host,
    port: redis.options.port
  });
});

redis.on('error', (err) => {
  logger.error('Redis error', {
    error: err.message,
    code: err.code
  });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

// Health check
const healthCheck = async () => {
  if (!redisOptions || redis.status === 'disabled') {
    return { status: 'not_configured' };
  }
  try {
    const start = Date.now();
    const pong = await redis.ping();
    const duration = Date.now() - start;

    return {
      status: 'healthy',
      response: pong,
      responseTime: `${duration}ms`,
      memory: await redis.info('memory'),
      connectedClients: await redis.info('clients')
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down Redis connection...');
  try {
    await redis.quit();
    logger.info('Redis connection closed successfully');
  } catch (error) {
    logger.error('Error closing Redis connection', { error: error.message });
    // Force disconnect
    redis.disconnect();
  }
};

// Cache helper functions
const cache = {
  // Set with expiration
  async set(key, value, ttlSeconds = 3600) {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
    return redis.setex(key, ttlSeconds, serialized);
  },

  // Get and parse
  async get(key) {
    const value = await redis.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },

  // Delete key
  async del(key) {
    return redis.del(key);
  },

  // Delete multiple keys by pattern
  async delByPattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      return redis.del(...keys);
    }
    return 0;
  },

  // Check if key exists
  async exists(key) {
    return redis.exists(key);
  },

  // Increment
  async incr(key) {
    return redis.incr(key);
  },

  // Decrement
  async decr(key) {
    return redis.decr(key);
  },

  // Set expiration
  async expire(key, seconds) {
    return redis.expire(key, seconds);
  },

  // Get TTL
  async ttl(key) {
    return redis.ttl(key);
  }
};

// Rate limiter helper
const rateLimiter = {
  // Check and increment rate limit
  async check(key, maxRequests, windowSeconds) {
    const current = await redis.incr(key);

    if (current === 1) {
      // First request, set expiration
      await redis.expire(key, windowSeconds);
    }

    return {
      allowed: current <= maxRequests,
      current,
      remaining: Math.max(0, maxRequests - current),
      resetAt: await redis.ttl(key)
    };
  },

  // Reset rate limit
  async reset(key) {
    return redis.del(key);
  }
};

// Session store helper
const sessionStore = {
  async set(key, data, ttlSeconds = 86400) {
    return redis.setex(`session:${key}`, ttlSeconds, JSON.stringify(data));
  },

  async get(key) {
    const data = await redis.get(`session:${key}`);
    return data ? JSON.parse(data) : null;
  },

  async delete(key) {
    return redis.del(`session:${key}`);
  },

  async refresh(key, ttlSeconds = 86400) {
    return redis.expire(`session:${key}`, ttlSeconds);
  }
};

// User session tracking (for security)
const userSessions = {
  async add(userId, token, ttlSeconds = 604800) {
    await redis.sadd(`user_sessions:${userId}`, token);
    await redis.expire(`user_sessions:${userId}`, ttlSeconds);
  },

  async remove(userId, token) {
    await redis.srem(`user_sessions:${userId}`, token);
  },

  async removeAll(userId) {
    return redis.del(`user_sessions:${userId}`);
  },

  async getAll(userId) {
    return redis.smembers(`user_sessions:${userId}`);
  },

  async count(userId) {
    return redis.scard(`user_sessions:${userId}`);
  }
};

// Account lockout helper
const lockout = {
  async isLocked(userId) {
    return redis.exists(`locked:${userId}`);
  },

  async lock(userId, durationSeconds = 900) {
    await redis.setex(`locked:${userId}`, durationSeconds, '1');
  },

  async unlock(userId) {
    return redis.del(`locked:${userId}`);
  },

  async getRemainingTime(userId) {
    return redis.ttl(`locked:${userId}`);
  }
};

module.exports = {
  redis,
  healthCheck,
  shutdown,
  cache,
  rateLimiter,
  sessionStore,
  userSessions,
  lockout
};

module.exports.default = module.exports;