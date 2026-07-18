/**
 * Session Routes
 * Learning session management
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/authMiddleware');
const { sessionValidation } = require('../middleware/validators/authValidators');
const { catchAsync, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../config/logger');
const queries = require('../models/sql/queries');
const { activeSessionsGauge } = require('../config/metrics');

/**
 * GET /sessions
 * List student's sessions
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { limit = 20, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const sessions = await queries.sessions.getStudentSessions(studentId, parseInt(limit, 10));

  res.json({
    sessions: sessions.map(s => ({
      sessionId: s.session_id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      duration: s.duration,
      questionsAnswered: s.questions_answered,
      correctAnswers: s.correct_answers,
      accuracy: s.questions_answered > 0
        ? ((s.correct_answers / s.questions_answered) * 100).toFixed(1)
        : 0,
      status: s.status
    })),
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    }
  });
}));

/**
 * POST /sessions
 * Start new session
 */
router.post('/', authenticate, sessionValidation, catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { classId } = req.body;
  const sessionId = uuidv4();

  const session = await queries.sessions.create(sessionId, studentId, classId);

  // Track active session
  activeSessionsGauge.inc({ platform: 'web' });

  // Emit to socket if available
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${studentId}`).emit('session:started', {
      sessionId,
      startedAt: session.started_at
    });
  }

  logger.info('Session started', { sessionId, studentId });

  res.status(201).json({
    sessionId: session.session_id,
    startedAt: session.started_at,
    status: session.status
  });
}));

/**
 * GET /sessions/:id
 * Get session details
 */
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const sessionId = req.params.id;

  const session = await queries.sessions.getById(sessionId);

  if (!session) {
    throw new NotFoundError('Session');
  }

  // Check ownership or teacher role
  if (session.student_id !== req.user.id && !['admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied to this session'
    });
  }

  res.json({
    sessionId: session.session_id,
    studentId: session.student_id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    duration: session.duration,
    questionsAnswered: session.questions_answered,
    correctAnswers: session.correct_answers,
    status: session.status,
    difficultyDistribution: session.difficulty_distribution || {}
  });
}));

/**
 * POST /sessions/:id/end
 * End session
 */
router.post('/:id/end', authenticate, catchAsync(async (req, res) => {
  const sessionId = req.params.id;
  const studentId = req.user.id;

  const session = await queries.sessions.getById(sessionId);

  if (!session) {
    throw new NotFoundError('Session');
  }

  if (session.student_id !== studentId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied to this session'
    });
  }

  // Calculate stats
  const stats = {
    duration: Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000),
    questionsAnswered: session.questions_answered || 0,
    correctAnswers: session.correct_answers || 0
  };

  const updatedSession = await queries.sessions.end(sessionId, stats);

  // Update active sessions gauge
  activeSessionsGauge.dec({ platform: 'web' });

  // Emit to socket
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${studentId}`).emit('session:ended', {
      sessionId,
      stats
    });
  }

  logger.info('Session ended', { sessionId, ...stats });

  res.json({
    sessionId: updatedSession.session_id,
    duration: updatedSession.duration,
    questionsAnswered: updatedSession.questions_answered,
    correctAnswers: updatedSession.correct_answers,
    accuracy: updatedSession.questions_answered > 0
      ? ((updatedSession.correct_answers / updatedSession.questions_answered) * 100).toFixed(1)
      : 0,
    endedAt: updatedSession.ended_at
  });
}));

module.exports = router;