/**
 * Question Routes
 * Adaptive question selection and retrieval
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { catchAsync, NotFoundError } = require('../middleware/errorHandler');
const queries = require('../models/sql/queries');
const { selectNextQuestion } = require('../services/adaptationService');
const redis = require('../config/redis');

/**
 * GET /questions/adaptive
 * Get next adaptive question for student
 */
router.get('/adaptive', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { sessionId, skillId } = req.query;

  // Check cache first
  const cacheKey = `adaptive:${studentId}:${skillId || 'any'}`;
  const cached = await redis.cache.get(cacheKey);
  if (cached && !sessionId) {
    return res.json(cached);
  }

  // Get mastery profile
  let masteryProfile = await queries.mastery.getStudentMastery(studentId);

  // If specific skill requested
  if (skillId) {
    const skillMastery = await queries.mastery.getSkillMastery(studentId, skillId);
    masteryProfile = skillMastery ? [skillMastery] : [];
  }

  // Select next question
  const result = await selectNextQuestion(studentId, sessionId, masteryProfile);

  if (!result) {
    throw new NotFoundError('Question');
  }

  // Cache for 5 minutes (if not in active session)
  if (!sessionId) {
    await redis.cache.set(cacheKey, result, 300);
  }

  res.json(result);
}));

/**
 * GET /questions/:id
 * Get question by ID
 */
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const questionId = req.params.id;

  const question = await queries.questions.getById(questionId);

  if (!question) {
    throw new NotFoundError('Question');
  }

  // Return sanitized question (no correct answer)
  res.json({
    questionId: question.question_id,
    skillId: question.skill_id,
    skillName: question.skill_name,
    questionTitle: question.question_title,
    questionText: question.question_text,
    difficultyLevel: question.difficulty_level,
    hints: [
      question.hint_1,
      question.hint_2
    ].filter(Boolean)
  });
}));

/**
 * GET /questions/by-skill/:skillId
 * Get questions for a specific skill
 */
router.get('/by-skill/:skillId', authenticate, catchAsync(async (req, res) => {
  const { skillId } = req.params;
  const { limit = 10, difficulty } = req.query;

  let questions;

  if (difficulty) {
    questions = await queries.questions.getByDifficulty(skillId, difficulty, parseInt(limit, 10));
  } else {
    questions = await queries.questions.getBySkill(skillId, parseInt(limit, 10));
  }

  // Sanitize questions
  const sanitized = questions.map(q => ({
    questionId: q.question_id,
    skillId: q.skill_id,
    questionText: q.question_text,
    difficultyLevel: q.difficulty_level
  }));

  res.json({ questions: sanitized });
}));

module.exports = router;