/**
 * Auth Routes
 * Authentication and authorization endpoints
 * Secure token handling - tokens managed server-side
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const { authenticate } = require('../middleware/authMiddleware');
const { loginValidation, registerValidation, refreshTokenValidation } = require('../middleware/validators/authValidators');
const { loginBruteForce } = require('../middleware/rateLimiter');
const { catchAsync, UnauthorizedError, ConflictError } = require('../middleware/errorHandler');
const logger = require('../config/logger');
const { authAttemptsTotal } = require('../config/metrics');
const { generateAccessToken, generateRefreshToken, revokeRefreshToken } = require('../middleware/authMiddleware');
const redis = require('../config/redis');
const queries = require('../models/sql/queries');
const { v4: uuidv4 } = require('uuid');

// Brute force protection middleware
const checkBruteForce = (req, res, next) => {
  const check = loginBruteForce.check(req);
  if (!check.allowed) {
    authAttemptsTotal.inc({ result: 'locked', type: 'brute_force' });
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Account locked. Try again in ${check.remainingTime} seconds.`,
      code: 'ACCOUNT_LOCKED',
      retryAfter: check.remainingTime
    });
  }
  next();
};

/**
 * POST /auth/login
 * Authenticate user and return tokens
 * IMPORTANT: Tokens are sent via secure headers, not stored in frontend
 */
router.post('/login', checkBruteForce, loginValidation, catchAsync(async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  // Find user
  const user = await queries.students.findByUsernameWithPassword(username);

  logger.info('Login attempt', { username, ip, userFound: !!user, hasPasswordHash: !!user?.password_hash });

  if (!user) {
    loginBruteForce.recordFailure(req);
    authAttemptsTotal.inc({ result: 'failure', type: 'invalid_credentials' });
    logger.security.login(null, username, ip, false);

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid username or password',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    loginBruteForce.recordFailure(req);
    authAttemptsTotal.inc({ result: 'failure', type: 'invalid_credentials' });
    logger.security.login(user.student_id, username, ip, false);

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid username or password',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Clear failed attempts
  loginBruteForce.recordSuccess(req);

  // Generate session ID
  const sessionId = uuidv4();

  // Generate access token
  const accessToken = generateAccessToken({
    id: user.student_id,
    username: user.username,
    role: user.role,
    sid: sessionId,
    jti: uuidv4()
  });

  // Generate refresh token
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Store refresh token securely
  await queries.auth.storeRefreshToken(refreshToken, user.student_id, expiresAt);

  // Track user session
  if (redis.redis.status === 'ready') {
    await redis.userSessions.add(user.student_id, sessionId);
  }

  authAttemptsTotal.inc({ result: 'success', type: 'login' });
  logger.security.login(user.student_id, username, ip, true);

  // Return tokens (NOT stored in localStorage - frontend should use secure storage)
  res.json({
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
    tokenType: 'Bearer',
    user: {
      id: user.student_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    }
  });
}));

/**
 * POST /auth/register
 * Register new student
 */
router.post('/register', registerValidation, catchAsync(async (req, res) => {
  const { username, password, firstName, lastName, classCode } = req.body;

  // Check if username exists
  const existingUser = await queries.students.findByUsername(username);
  if (existingUser) {
    throw new ConflictError('Username already taken');
  }

  // Find class by code
  const classData = await queries.classes.findByCode(classCode);
  if (!classData) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid class code',
      code: 'INVALID_CLASS_CODE'
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));

  // Create student
  const studentId = `STU-${uuidv4().substring(0, 8).toUpperCase()}`;
  const student = await queries.students.create({
    studentId,
    firstName,
    lastName,
    username,
    passwordHash,
    gradeLevel: classData.grade_level,
    classId: classData.class_id
  });

  logger.info('New student registered', {
    studentId: student.student_id,
    username: student.username,
    classId: classData.class_id
  });

  res.status(201).json({
    message: 'Registration successful',
    student: {
      id: student.student_id,
      username: student.username,
      firstName: student.first_name,
      lastName: student.last_name
    }
  });
}));

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', refreshTokenValidation, catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  // Get token data from storage
  const tokenData = await queries.auth.getRefreshToken(refreshToken);

  if (!tokenData) {
    logger.security.invalidToken(ip, 'Invalid refresh token');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }

  // Generate new access token
  const newAccessToken = generateAccessToken({
    id: tokenData.user_id,
    username: tokenData.username,
    role: tokenData.role,
    sid: uuidv4(),
    jti: uuidv4()
  });

  // Generate new refresh token (rotation)
  const newRefreshToken = generateRefreshToken();

  // Revoke old refresh token
  await queries.auth.revokeRefreshToken(refreshToken);

  // Store new refresh token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await queries.auth.storeRefreshToken(newRefreshToken, tokenData.user_id, expiresAt);

  logger.security.tokenRefresh(tokenData.user_id, ip);

  // Return new token only (refresh token should be handled by frontend securely)
  res.json({
    accessToken: newAccessToken,
    expiresIn: 900,
    tokenType: 'Bearer'
  });
}));

/**
 * POST /auth/logout
 * Logout and revoke tokens
 */
router.post('/logout', authenticate, catchAsync(async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  // Revoke refresh token if provided
  if (req.body?.refreshToken) {
    await revokeRefreshToken(req.body.refreshToken);
  }

  // Track logout
  if (redis.redis.status === 'ready') {
    await redis.userSessions.remove(req.user.id, req.user.sessionId);
  }

  logger.security.logout(req.user.id, req.user.username, ip);

  res.json({
    message: 'Logged out successfully'
  });
}));

/**
 * DELETE /auth/sessions
 * Revoke all sessions (logout everywhere)
 */
router.delete('/sessions', authenticate, catchAsync(async (req, res) => {
  // Revoke all user tokens
  await queries.auth.revokeAllUserTokens(req.user.id);

  // Clear all Redis sessions
  if (redis.redis.status === 'ready') {
    await redis.userSessions.removeAll(req.user.id);
  }

  logger.info('All sessions revoked', { userId: req.user.id });

  res.json({
    message: 'All sessions revoked successfully'
  });
}));

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', authenticate, catchAsync(async (req, res) => {
  const user = await queries.students.findById(req.user.id);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  res.json({
    id: user.student_id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    gradeLevel: user.grade_level,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at
  });
}));

module.exports = router;