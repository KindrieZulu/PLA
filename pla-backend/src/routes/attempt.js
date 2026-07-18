/**
 * Attempt Routes
 * Question attempt submission and tracking
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/authMiddleware');
const { attemptValidation, bulkAttemptValidation } = require('../middleware/validators/authValidators');
const { catchAsync, NotFoundError } = require('../middleware/errorHandler');
const queries = require('../models/sql/queries');
const { updateCombinedMastery } = require('../services/bktService');
const { Attempt } = require('../config/mongo');
const logger = require('../config/logger');
const { quizAttemptsTotal } = require('../config/metrics');

/**
 * POST /attempts
 * Submit a single attempt
 */
router.post('/', authenticate, attemptValidation, catchAsync(async (req, res) => {
  const { sessionId, questionId, answer, timeSpent = 0, hintUsed = 0, difficultyLevel } = req.body;
  const studentId = req.user.id;

  // Get question details
  const question = await queries.questions.getById(questionId);
  if (!question) {
    throw new NotFoundError('Question');
  }

  // Check answer correctness (case-insensitive comparison)
  const isCorrect = answer.trim().toLowerCase() === question.correct_option.trim().toLowerCase();

  // Get current mastery for this skill
  const currentMastery = await queries.mastery.getSkillMastery(studentId, question.skill_id);

  // Get skill parameters
  const skillParams = {
    prior: parseFloat(currentMastery?.bkt_prior || 0.3),
    learn: parseFloat(currentMastery?.bkt_learn || 0.2),
    slip: parseFloat(currentMastery?.bkt_slip || 0.1),
    guess: parseFloat(currentMastery?.bkt_guess || 0.2)
  };

  // Calculate streak
  const streak = isCorrect ? (currentMastery?.streak || 0) + 1 : 0;

  // Update combined BKT + IRT mastery
  const masteryUpdate = updateCombinedMastery(
    {
      masteryProbability: currentMastery?.mastery_probability || 0.3,
      thetaEstimate: currentMastery?.theta_estimate || 0,
      lastPracticed: currentMastery?.last_practiced
    },
    {
      isCorrect,
      hintUsed,
      responseTime: timeSpent,
      difficulty: difficultyLevel || question.difficulty_level,
      streak,
      tryCount: 1,
      skillParams
    }
  );

  // Save mastery update
  await queries.mastery.upsertMastery(studentId, question.skill_id, {
    masteryProbability: masteryUpdate.masteryProbability,
    theta: masteryUpdate.thetaEstimate,
    timesCorrect: (currentMastery?.times_correct || 0) + (isCorrect ? 1 : 0),
    timesIncorrect: (currentMastery?.times_incorrect || 0) + (isCorrect ? 0 : 1),
    hintsUsed: (currentMastery?.hints_used || 0) + hintUsed,
    streak,
    lastPracticed: new Date()
  });

  // Store attempt in MongoDB
  const attemptId = uuidv4();
  await Attempt.create({
    attemptId,
    sessionId,
    studentId,
    questionId,
    skillId: question.skill_id,
    answer,
    correct: isCorrect,
    hintUsed,
    timeSpent,
    timestamp: new Date(),
    difficultyLevel: difficultyLevel || question.difficulty_level,
    tryCount: 1
  });

  // Update session stats
  await updateSessionStats(sessionId, isCorrect);

  // Track in metrics
  quizAttemptsTotal.inc({
    difficulty: difficultyLevel || question.difficulty_level,
    correct: isCorrect ? 'true' : 'false'
  });

  // Emit mastery update via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${studentId}`).emit('mastery:updated', {
      skillId: question.skill_id,
      mastery: masteryUpdate.masteryProbability,
      status: masteryUpdate.masteryStatus
    });
  }

  logger.debug('Attempt recorded', {
    attemptId,
    studentId,
    questionId,
    isCorrect,
    newMastery: masteryUpdate.masteryProbability
  });

  res.json({
    attemptId,
    isCorrect,
    correctAnswer: isCorrect ? null : question.correct_option, // Only show if wrong
    explanation: question.explanation,
    mastery: {
      probability: masteryUpdate.masteryProbability,
      status: masteryUpdate.masteryStatus,
      theta: masteryUpdate.thetaEstimate,
      abilityLabel: masteryUpdate.abilityLabel
    }
  });
}));

/**
 * POST /attempts/bulk
 * Bulk sync offline attempts
 */
router.post('/bulk', authenticate, bulkAttemptValidation, catchAsync(async (req, res) => {
  const { attempts } = req.body;
  const studentId = req.user.id;

  const results = [];
  let syncedCount = 0;

  for (const attemptData of attempts) {
    try {
      // Process each attempt
      const { sessionId, questionId, answer, timestamp, timeSpent, hintUsed } = attemptData;

      // Find question
      const question = await queries.questions.getById(questionId);
      if (!question) continue;

      // Check correctness
      const isCorrect = answer.trim().toLowerCase() === question.correct_option.trim().toLowerCase();

      // Get current mastery
      let currentMastery = await queries.mastery.getSkillMastery(studentId, question.skill_id);

      // If no mastery record, create one
      if (!currentMastery) {
        currentMastery = {
          mastery_probability: 0.3,
          theta_estimate: 0,
          times_correct: 0,
          times_incorrect: 0,
          hints_used: 0,
          streak: 0
        };
      }

      // Calculate streak
      const streak = isCorrect ? (currentMastery.streak || 0) + 1 : 0;

      // Update mastery
      const masteryUpdate = updateCombinedMastery(
        {
          masteryProbability: currentMastery.mastery_probability,
          thetaEstimate: currentMastery.theta_estimate,
          lastPracticed: currentMastery.last_practiced
        },
        {
          isCorrect,
          hintUsed: hintUsed || 0,
          responseTime: timeSpent || 0,
          difficulty: question.difficulty_level,
          streak,
          tryCount: 1,
          skillParams: {}
        }
      );

      // Save mastery
      await queries.mastery.upsertMastery(studentId, question.skill_id, {
        masteryProbability: masteryUpdate.masteryProbability,
        theta: masteryUpdate.thetaEstimate,
        timesCorrect: (currentMastery.times_correct || 0) + (isCorrect ? 1 : 0),
        timesIncorrect: (currentMastery.times_incorrect || 0) + (isCorrect ? 0 : 1),
        hintsUsed: (currentMastery.hints_used || 0) + (hintUsed || 0),
        streak,
        lastPracticed: new Date(timestamp)
      });

      // Store in MongoDB with offline flag
      await Attempt.create({
        attemptId: uuidv4(),
        sessionId: sessionId || 'offline',
        studentId,
        questionId,
        skillId: question.skill_id,
        answer,
        correct: isCorrect,
        hintUsed: hintUsed || 0,
        timeSpent: timeSpent || 0,
        timestamp: new Date(timestamp),
        offline: true,
        syncedAt: new Date(),
        clientTimestamp: new Date(timestamp),
        difficultyLevel: question.difficulty_level
      });

      results.push({
        questionId,
        isCorrect,
        synced: true
      });
      syncedCount++;
    } catch (error) {
      logger.error('Failed to sync attempt', { error: error.message });
      results.push({
        questionId: attemptData.questionId,
        synced: false,
        error: error.message
      });
    }
  }

  logger.info('Bulk sync completed', {
    studentId,
    total: attempts.length,
    synced: syncedCount
  });

  res.json({
    total: attempts.length,
    synced: syncedCount,
    results
  });
}));

/**
 * GET /attempts/:id
 * Get attempt details
 */
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const attemptId = req.params.id;

  const attempt = await Attempt.findOne({ attemptId });

  if (!attempt) {
    throw new NotFoundError('Attempt');
  }

  // Check ownership
  if (attempt.studentId !== req.user.id && !['admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied'
    });
  }

  res.json({
    attemptId: attempt.attemptId,
    sessionId: attempt.sessionId,
    questionId: attempt.questionId,
    answer: attempt.answer,
    correct: attempt.correct,
    timeSpent: attempt.timeSpent,
    timestamp: attempt.timestamp,
    hintUsed: attempt.hintUsed
  });
}));

// Helper function to update session stats
async function updateSessionStats(sessionId, isCorrect) {
  try {
    // This would typically be done via a transaction or atomic update
    // For now, we'll track in MongoDB
    const session = await require('../config/mongo').Session.findOne({ sessionId });
    if (session) {
      session.questionsAnswered = (session.questionsAnswered || 0) + 1;
      if (isCorrect) {
        session.correctAnswers = (session.correctAnswers || 0) + 1;
      }
      await session.save();
    }
  } catch (error) {
    logger.error('Failed to update session stats', { error: error.message });
  }
}

module.exports = router;