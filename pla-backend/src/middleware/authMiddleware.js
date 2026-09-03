/**
 * Authentication Middleware
 * JWT token verification with refresh token support
 * Secure token handling - NO tokens exposed to frontend APIs
 */

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { authAttemptsTotal } = require('../config/metrics');
const redis = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw { code: 'TOKEN_EXPIRED', message: 'Access token has expired' };
    }
    if (error.name === 'JsonWebTokenError') {
      throw { code: 'INVALID_TOKEN', message: 'Invalid access token' };
    }
    throw error;
  }
};

// Generate access token
const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'PLA',
    audience: 'PLA-API'
  });
};

// Generate refresh token (opaque token stored in DB)
const generateRefreshToken = () => {
  return require('crypto').randomBytes(64).toString('hex');
};

// Verify token middleware
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header only (NOT from query params or cookies for API)
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.security.invalidToken(req.ip, 'Missing Authorization header');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token required',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token not provided',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verify the token
    const decoded = verifyAccessToken(token);

    // Check if token has been revoked (stored in Redis)
    if (redis.redis.status === 'ready') {
      const isRevoked = await redis.cache.exists(`revoked:${decoded.jti}`);
      if (isRevoked) {
        logger.security.invalidToken(req.ip, 'Token has been revoked', decoded.id);
        authAttemptsTotal.inc({ result: 'failure', type: 'revoked_token' });
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has been revoked',
          code: 'TOKEN_REVOKED'
        });
      }
    }

    // Attach user to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      sessionId: decoded.sid, // Session ID for tracking
      jti: decoded.jti // JWT ID for revocation
    };

    // Log successful authentication for audit
    logger.debug('User authenticated', {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role
    });

    next();
  } catch (error) {
    if (error.code === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message,
        code: 'TOKEN_EXPIRED',
        action: 'refresh_token'
      });
    }

    if (error.code === 'INVALID_TOKEN') {
      logger.security.invalidToken(req.ip, error.message);
      authAttemptsTotal.inc({ result: 'failure', type: 'invalid_token' });
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message,
        code: 'INVALID_TOKEN'
      });
    }

    logger.error('Authentication error', { error: error.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication processing failed',
      code: 'AUTH_ERROR'
    });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
  } catch (error) {
    // Ignore errors for optional auth
    logger.debug('Optional auth failed', { error: error.message });
  }

  next();
};

// Refresh token middleware
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    // Get refresh token from database/Redis
    // This is a secure backend operation - token is validated against storage
    const tokenData = await getRefreshToken(token);

    if (!tokenData) {
      logger.security.invalidToken(req.ip, 'Invalid refresh token');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Check if token is expired
    if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
      await revokeRefreshToken(token);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token has expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      id: tokenData.userId,
      username: tokenData.username,
      role: tokenData.role,
      sid: tokenData.sessionId,
      jti: require('uuid').v4()
    });

    // Generate new refresh token (rotation)
    const newRefreshToken = generateRefreshToken();

    // Revoke old refresh token
    await revokeRefreshToken(token);

    // Store new refresh token
    await storeRefreshToken(newRefreshToken, {
      userId: tokenData.userId,
      username: tokenData.username,
      role: tokenData.role,
      sessionId: tokenData.sessionId
    });

    logger.security.tokenRefresh(tokenData.userId, req.ip);

    // Return tokens via secure method (NOT stored in localStorage)
    res.json({
      accessToken: newAccessToken,
      expiresIn: 900, // 15 minutes in seconds
      tokenType: 'Bearer'
      // NOTE: Refresh token is sent once and should be stored in secure HTTP-only cookie by frontend
      // For maximum security, consider using cookies instead of sending refresh token to client
    });

  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
};

// Helper functions for refresh token management
const getRefreshToken = async (token) => {
  if (redis.redis.status === 'ready') {
    return await redis.cache.get(`refresh:${token}`);
  }
  // Fallback to database query
  const queries = require('../models/sql/queries');
  return await queries.getRefreshToken(token);
};

const storeRefreshToken = async (token, data) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  if (redis.redis.status === 'ready') {
    await redis.cache.set(`refresh:${token}`, { ...data, expiresAt }, 7 * 24 * 60 * 60);
    return;
  }
  // Fallback to database
  const queries = require('../models/sql/queries');
  await queries.storeRefreshToken(token, data.userId, expiresAt);
};

const revokeRefreshToken = async (token) => {
  if (redis.redis.status === 'ready') {
    await redis.cache.del(`refresh:${token}`);
    return;
  }
  // Fallback to database
  const queries = require('../models/sql/queries');
  await queries.revokeRefreshToken(token);
};

// Revoke all tokens for a user (logout everywhere)
const revokeAllUserTokens = async (userId) => {
  if (redis.redis.status === 'ready') {
    await redis.userSessions.removeAll(userId);
    return;
  }
  // Fallback to database
  const queries = require('../models/sql/queries');
  await queries.revokeAllUserTokens(userId);
};

module.exports = {
  authenticate,
  optionalAuth,
  refreshToken,
  verifyAccessToken,
  generateAccessToken,
  generateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens
};