/**
 * Role-Based Access Control Middleware
 * Enforces role-based authorization
 */

const logger = require('../config/logger');

// Role hierarchy
const ROLES = {
  admin: 4,
  teacher: 3,
  student: 2,
  guest: 1
};

// Check if user has required role
const hasRole = (userRole, requiredRole) => {
  return (ROLES[userRole] || 0) >= (ROLES[requiredRole] || 0);
};

// Require specific role(s)
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
        code: 'INSUFFICIENT_ROLE'
      });
    }

    next();
  };
};

// Require admin role
const requireAdmin = requireRole('admin');

// Require teacher or admin
const requireTeacher = requireRole('admin', 'teacher');

// Require student or higher
const requireStudent = requireRole('admin', 'teacher', 'student');

// Check resource ownership or admin/teacher
const requireOwnershipOrRole = (ownershipField = 'studentId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admin and teachers can access all resources
    if (['admin', 'teacher'].includes(req.user.role)) {
      return next();
    }

    // Students can only access their own resources
    const resourceOwner = req.params[ownershipField] || req.body[ownershipField];

    if (resourceOwner && resourceOwner !== req.user.id) {
      logger.warn('Access denied - not resource owner', {
        userId: req.user.id,
        resourceOwner,
        path: req.path
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources',
        code: 'NOT_OWNER'
      });
    }

    next();
  };
};

// Require session ownership
const requireSessionOwnership = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Admin and teachers bypass
  if (['admin', 'teacher'].includes(req.user.role)) {
    return next();
  }

  // For student, verify session belongs to them
  if (req.params.sessionId) {
    try {
      const queries = require('../models/sql/queries');
      const session = await queries.getSessionById(req.params.sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      if (session.student_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this session',
          code: 'SESSION_ACCESS_DENIED'
        });
      }
    } catch (error) {
      logger.error('Session ownership check failed', { error: error.message });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify session ownership',
        code: 'OWNERSHIP_CHECK_FAILED'
      });
    }
  }

  next();
};

// CSRF protection (for state-changing operations)
const requireCSRFToken = (req, res, next) => {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;

  // In production, CSRF token is required
  if (process.env.NODE_ENV === 'production') {
    if (!csrfToken || csrfToken !== sessionToken) {
      logger.warn('CSRF validation failed', {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid CSRF token',
        code: 'CSRF_INVALID'
      });
    }
  }

  next();
};

// Require verified email
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!req.user.verified) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  next();
};

module.exports = {
  ROLES,
  hasRole,
  requireRole,
  requireAdmin,
  requireTeacher,
  requireStudent,
  requireOwnershipOrRole,
  requireSessionOwnership,
  requireCSRFToken,
  requireVerifiedEmail
};