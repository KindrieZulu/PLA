/**
 * Audit Logger Middleware
 * Logs all requests for security and compliance
 */

const logger = require('../config/logger');
const { AuditLog } = require('../config/mongo');

// Paths to exclude from audit
const EXCLUDED_PATHS = [
  '/health',
  '/metrics',
  '/favicon.ico',
  '/api/v1/health'
];

// Sensitive fields to redact
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'refreshToken',
  'token',
  'secret',
  'apiKey',
  'creditCard',
  'cvv'
];

// Redact sensitive data
const redactSensitiveData = (data) => {
  if (!data || typeof data !== 'object') return data;

  const redacted = { ...data };

  for (const field of SENSITIVE_FIELDS) {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  }

  return redacted;
};

// Extract user info
const extractUserInfo = (req) => {
  return {
    userId: req.user?.id || null,
    username: req.user?.username || null,
    role: req.user?.role || 'anonymous'
  };
};

// Audit logger middleware
const auditLogger = async (req, res, next) => {
  // Skip excluded paths
  if (EXCLUDED_PATHS.includes(req.path)) {
    return next();
  }

  const startTime = Date.now();
  const requestInfo = {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    ...extractUserInfo(req),
    requestId: req.id
  };

  // Capture original response data
  const originalJson = res.json.bind(res);
  let responseBody = null;

  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  // Log when response finishes
  res.on('finish', async () => {
    const duration = Date.now() - startTime;

    const auditEntry = {
      event: `${req.method}:${req.path}`,
      userId: requestInfo.userId,
      username: requestInfo.username,
      role: requestInfo.role,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      resource: req.path,
      action: req.method,
      details: {
        query: req.query,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.id,
        contentLength: res.get('Content-Length')
      },
      timestamp: new Date(),
      duration,
      statusCode: res.statusCode
    };

    // Log based on severity
    if (res.statusCode >= 500) {
      logger.error('Server error audit', auditEntry);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error audit', auditEntry);
    } else {
      logger.info('Request completed', {
        event: 'HTTP_REQUEST',
        ...auditEntry
      });
    }

    // Store in MongoDB for compliance (async, don't block response)
    // Skip if MongoDB is not connected
    if (process.env.NODE_ENV === 'production' && process.env.MONGO_URI) {
      try {
        if (!EXCLUDED_PATHS.includes(req.path)) {
          await AuditLog.create(auditEntry);
        }
      } catch (error) {
        // Silent fail — MongoDB is optional
      }
    }
  });

  next();
};

// Security-specific audit
const securityAudit = async (req, res, next) => {
  // Log security-relevant events
  const securityEvents = {
    'POST:/api/v1/auth/login': 'AUTH_LOGIN_ATTEMPT',
    'POST:/api/v1/auth/logout': 'AUTH_LOGOUT',
    'POST:/api/v1/auth/refresh': 'AUTH_TOKEN_REFRESH',
    'POST:/api/v1/auth/register': 'AUTH_REGISTRATION',
    'DELETE:/api/v1/auth/sessions': 'AUTH_SESSION_REVOKE',
    'PUT:/api/v1/admin': 'ADMIN_ACTION',
    'POST:/api/v1/attempts': 'QUIZ_SUBMISSION'
  };

  const eventKey = `${req.method}:${req.path}`;
  const eventType = securityEvents[eventKey];

  if (eventType) {
    const securityEntry = {
      event: eventType,
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      resource: req.path,
      action: req.method,
      details: {
        userRole: req.user?.role,
        requestId: req.id,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      statusCode: res.statusCode || null
    };

    logger.security.sensitiveOperation(req.user?.id, eventType, securityEntry);

    // Store in MongoDB (skip if not available)
    if (process.env.MONGO_URI) {
      try {
        await AuditLog.create(securityEntry);
      } catch (error) {
        // Silent fail — MongoDB is optional
      }
    }
  }

  next();
};

module.exports = {
  auditLogger,
  securityAudit,
  redactSensitiveData
};