/**
 * PostgreSQL Configuration
 * Connection pool with health checks and automatic reconnection
 * Supports both individual env vars and DATABASE_URL (Render)
 */

const { Pool } = require('pg');
const logger = require('./logger');

// Build pool config - supports DATABASE_URL (Render) or individual vars
const buildPoolConfig = () => {
  // If DATABASE_URL is set (Render, Heroku, etc.), use it directly
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.POSTGRES_POOL_MAX || '20', 10),
      min: parseInt(process.env.POSTGRES_POOL_MIN || '2', 10),
      acquireTimeoutMillis: parseInt(process.env.POSTGRES_ACQUIRE_TIMEOUT || '30000', 10),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000', 10),
      allowExitOnIdle: false
    };
  }

  // Otherwise use individual environment variables
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB || 'pla_db',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.POSTGRES_POOL_MAX || '20', 10),
    min: parseInt(process.env.POSTGRES_POOL_MIN || '2', 10),
    acquireTimeoutMillis: parseInt(process.env.POSTGRES_ACQUIRE_TIMEOUT || '30000', 10),
    idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000', 10),
    allowExitOnIdle: false
  };
};

const poolConfig = buildPoolConfig();

// Create the pool
const pool = new Pool(poolConfig);

// Connection event handlers
pool.on('connect', (client) => {
  logger.debug('New PostgreSQL client connected', {
    poolSize: pool.totalCount,
    idleCount: pool.idleCount
  });
});

pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

pool.on('remove', (client) => {
  logger.debug('Client removed from pool', {
    poolSize: pool.totalCount,
    idleCount: pool.idleCount
  });
});

// Error handler
pool.on('error', (err, client) => {
  logger.error('Unexpected PostgreSQL pool error', {
    error: err.message,
    stack: err.stack
  });
});

// Health check function
const healthCheck = async () => {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT NOW() as now, version() as version');
    const duration = Date.now() - start;
    return {
      status: 'healthy',
      responseTime: `${duration}ms`,
      version: result.rows[0].version.split(' ')[0],
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Query wrapper with logging
const query = async (text, params) => {
  const start = Date.now();
  const stackTrace = process.env.NODE_ENV === 'development' ? new Error().stack : null;

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      query: text.substring(0, 100),
      params: params ? `[${params.length} params]` : null,
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    // Log slow queries
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        query: text.substring(0, 200),
        duration: `${duration}ms`,
        stackTrace: stackTrace ? stackTrace.substring(0, 500) : null
      });
    }

    return result;
  } catch (error) {
    logger.error('Query failed', {
      query: text.substring(0, 100),
      error: error.message,
      stackTrace: stackTrace ? stackTrace.substring(0, 500) : null
    });
    throw error;
  }
};

// Transaction wrapper
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down PostgreSQL pool...');
  try {
    await pool.end();
    logger.info('PostgreSQL pool closed successfully');
  } catch (error) {
    logger.error('Error closing PostgreSQL pool', { error: error.message });
    throw error;
  }
};

module.exports = {
  pool,
  query,
  transaction,
  healthCheck,
  shutdown,
  client: pool
};

module.exports.default = module.exports;