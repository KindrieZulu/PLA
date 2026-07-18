/**
 * Prometheus Metrics Configuration
 * Application-level metrics for monitoring and alerting
 */

const promClient = require('prom-client');
const logger = require('./logger');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// HTTP request counter
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code', 'app']
});
register.registerMetric(httpRequestsTotal);

// HTTP request duration histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code', 'app'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(httpRequestDuration);

// Active HTTP connections
const httpConnectionsActive = new promClient.Gauge({
  name: 'http_connections_active',
  help: 'Number of active HTTP connections',
  labelNames: ['app']
});
register.registerMetric(httpConnectionsActive);

// Authentication metrics
const authAttemptsTotal = new promClient.Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['result', 'type'] // result: success, failure, locked
});
register.registerMetric(authAttemptsTotal);

// Rate limit metrics
const rateLimitHitsTotal = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total rate limit exceeded events',
  labelNames: ['endpoint', 'ip']
});
register.registerMetric(rateLimitHitsTotal);

// Database metrics
const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['db_type', 'operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});
register.registerMetric(dbQueryDuration);

const dbConnectionsActive = new promClient.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  labelNames: ['db_type']
});
register.registerMetric(dbConnectionsActive);

// Cache metrics
const cacheHitsTotal = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type'] // redis, memory
});
register.registerMetric(cacheHitsTotal);

const cacheMissesTotal = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_type']
});
register.registerMetric(cacheMissesTotal);

// Learning analytics metrics
const quizAttemptsTotal = new promClient.Counter({
  name: 'quiz_attempts_total',
  help: 'Total quiz question attempts',
  labelNames: ['difficulty', 'correct']
});
register.registerMetric(quizAttemptsTotal);

const activeSessionsGauge = new promClient.Gauge({
  name: 'active_learning_sessions',
  help: 'Number of currently active learning sessions',
  labelNames: ['platform'] // web, mobile
});
register.registerMetric(activeSessionsGauge);

// Response size histogram
const httpResponseSize = new promClient.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'path'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
});
register.registerMetric(httpResponseSize);

// Error counter
const errorsTotal = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code', 'endpoint']
});
register.registerMetric(errorsTotal);

// Middleware to track HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Track active connections
  httpConnectionsActive.inc({ app: 'pla-backend' });

  // Capture response finish
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const path = req.route ? req.route.path : req.path;

    // Normalize path for metrics (replace dynamic segments)
    const normalizedPath = normalizePath(path);

    httpRequestsTotal.inc({
      method: req.method,
      path: normalizedPath,
      status_code: res.statusCode,
      app: 'pla-backend'
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        path: normalizedPath,
        status_code: res.statusCode,
        app: 'pla-backend'
      },
      duration
    );

    httpResponseSize.observe(
      {
        method: req.method,
        path: normalizedPath
      },
      parseInt(res.get('Content-Length') || '0', 10)
    );

    httpConnectionsActive.dec({ app: 'pla-backend' });

    // Track errors
    if (res.statusCode >= 500) {
      errorsTotal.inc({
        type: 'server_error',
        code: res.statusCode.toString(),
        endpoint: normalizedPath
      });
    } else if (res.statusCode >= 400) {
      errorsTotal.inc({
        type: 'client_error',
        code: res.statusCode.toString(),
        endpoint: normalizedPath
      });
    }
  });

  next();
};

// Normalize path to prevent high cardinality
const normalizePath = (path) => {
  return path
    .replace(/\/v[0-9]+/g, '/:version') // /api/v1 -> /api/:version
    .replace(/\/[a-f0-9-]{36}/gi, '/:id') // UUIDs
    .replace(/\/[0-9]+/g, '/:id') // Numeric IDs
    .replace(/\/$/, '') || '/';
};

// Get metrics endpoint handler
const getMetrics = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
};

module.exports = {
  register,
  metricsMiddleware,
  getMetrics,
  httpRequestsTotal,
  httpRequestDuration,
  authAttemptsTotal,
  rateLimitHitsTotal,
  dbQueryDuration,
  dbConnectionsActive,
  cacheHitsTotal,
  cacheMissesTotal,
  quizAttemptsTotal,
  activeSessionsGauge,
  errorsTotal
};