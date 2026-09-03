/**
 * Express Application Factory
 * Central configuration for middleware, routes, and error handling
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const xss = require('xss-clean');
const hpp = require('hpp');
const morgan = require('morgan');

const logger = require('./config/logger');
const { metricsMiddleware, getMetrics } = require('./config/metrics');
const { createRateLimiter, createAuthRateLimiter, createStricRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { auditLogger } = require('./middleware/auditLogger');

// Import routes
const v1Routes = require('./routes/v1');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const metricsRoutes = require('./routes/metrics');

// Create Express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : 1);

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", process.env.CDN_URL],
      scriptSrc: ["'self'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "blob:", process.env.CDN_URL],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// XSS Protection
app.use(xss());

// HTTP Parameter Pollution protection
app.use(hpp({
  whitelist: ['sort', 'order', 'page', 'limit'] // Allow duplicates for these params
}));

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // In development, allow everything
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Check configured origins
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || [];

    // Allow exact match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any onrender.com subdomain (Render assigns random suffixes)
    if (origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }

    // Allow localhost for local testing
    if (origin.startsWith('http://localhost')) {
      return callback(null, true);
    }

    logger.warn('CORS rejected origin', { origin });
    callback(null, true); // Allow in production for now (tighten later)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Version'],
  exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Request-Id'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compress']) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

// ==========================================
// BODY PARSING
// ==========================================

// Parse JSON with size limit
app.use(express.json({
  limit: '1mb',
  strict: true,
  reviver: (key, value) => {
    // Sanitize strings
    if (typeof value === 'string') {
      return value.replace(/<script/gi, '&lt;script').replace(/javascript:/gi, '');
    }
    return value;
  }
}));

// Parse URL-encoded bodies
app.use(express.urlencoded({
  extended: true,
  limit: '1mb',
  parameterLimit: 100
}));

// ==========================================
// LOGGING
// ==========================================

// HTTP request logging with Morgan
app.use(morgan('combined', {
  stream: logger.stream,
  skip: (req) => req.url === '/health' || req.url === '/metrics'
}));

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || require('uuid').v4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// ==========================================
// RATE LIMITING (per endpoint)
// ==========================================

// Global rate limiter
app.use('/api', createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10),
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP + user ID if authenticated
    return req.user?.id ? `${req.ip}:${req.user.id}` : req.ip;
  }
}));

// Auth routes - stricter rate limiting
app.use('/api/v1/auth', createAuthRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10),
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: false
}));

// Stricter rate limiting for sensitive operations
app.use('/api/v1/admin', createStricRateLimiter({
  windowMs: 60000, // 1 minute
  max: 30,
  message: 'Too many admin requests.'
}));

// ==========================================
// METRICS & MONITORING
// ==========================================

// Prometheus metrics middleware
app.use(metricsMiddleware);

// ==========================================
// AUDIT LOGGING
// ==========================================

// Audit all requests
app.use(auditLogger);

// ==========================================
// HEALTH CHECKS (no auth required)
// ==========================================

app.use('/', healthRoutes);

// ==========================================
// METRICS ENDPOINT (no auth required)
// ==========================================

app.use('/metrics', metricsRoutes);

// ==========================================
// API ROUTES
// ==========================================

// Mount v1 API routes
app.use('/api/v1', v1Routes);

// Mount auth routes (backward compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

// ==========================================
// API VERSION INFO
// ==========================================

app.get('/api', (req, res) => {
  res.json({
    name: 'PLA API',
    version: '1.0.0',
    description: 'Personalised Learning Assistant API',
    endpoints: {
      v1: '/api/v1',
      docs: '/api/v1/docs',
      health: '/health',
      metrics: '/metrics'
    },
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;