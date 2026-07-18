/**
 * Diagnostic Routes
 * Initial assessment endpoints
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/authMiddleware');
const { diagnosticSubmitValidation } = require('../middleware/validators/authValidators');
const { catchAsync, NotFoundError } = require('../middleware/errorHandler');
const queries = require('../models/sql/queries');
const { updateCombinedMastery } = require('../services/bktService');
const { Attempt } = require('../config/mongo');

/**
 * GET /diagnostic/questions
 * Get diagnostic test questions
 */
router.get('/questions', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { count = 20 } = req.query;

  // Check if diagnostic already completed
  const existingProfile = await queries.mastery.getStudentMastery(studentId);
  if (existingProfile.length > 0) {
    // Check if diagnostic completed recently
    const hasRecentDiagnostic = await checkRecentDiagnostic(studentId);
    if (hasRecentDiagnostic) {
      return res.json({
        message: 'Diagnostic already completed',
        completed: true,
        canRetake: false
      });
    }
  }

  // Get diagnostic questions from all modules
  const modules = await queries.curriculum.getModules('Form 1');
  let questions = [];

  for (const module of modules) {
    const moduleQuestions = await queries.questions.getDiagnosticQuestions(module.module_id, Math.ceil(count / modules.length));
    questions = questions.concat(moduleQuestions);
  }

  // Shuffle and limit
  questions = shuffleArray(questions).slice(0, parseInt(count, 10));

  // Return sanitized questions
  res.json({
    questions: questions.map(q => ({
      questionId: q.question_id,
      skillId: q.skill_id,
      skillName: q.skill_name,
      questionText: q.question_text,
      difficultyLevel: q.difficulty_level,
      options: extractOptions(q)
    })),
    totalQuestions: questions.length
  });
}));

/**
 * POST /diagnostic/submit
 * Submit diagnostic test results
 */
router.post('/submit', authenticate, diagnosticSubmitValidation, catchAsync(async (req, res) => {
  const { answers } = req.body;
  const studentId = req.user.id;

  let totalCorrect = 0;
  const skillResults = {};

  // Process each answer
  for (const answer of answers) {
    const { questionId, answer: studentAnswer, timeSpent } = answer;

    const question = await queries.questions.getById(questionId);
    if (!question) continue;

    const isCorrect = studentAnswer.trim().toLowerCase() === question.correct_option.trim().toLowerCase();
    if (isCorrect) totalCorrect++;

    // Initialize skill result
    if (!skillResults[question.skill_id]) {
      skillResults[question.skill_id] = {
        attempts: 0,
        correct: 0,
        skillName: question.skill_name
      };
    }
    skillResults[question.skill_id].attempts++;
    if (isCorrect) skillResults[question.skill_id].correct++;

    // Update mastery with initial estimate
    const masteryUpdate = updateCombinedMastery(
      {
        masteryProbability: 0.3,
        thetaEstimate: 0
      },
      {
        isCorrect,
        hintUsed: 0,
        responseTime: timeSpent || 30,
        difficulty: question.difficulty_level,
        streak: 0,
        tryCount: 1,
        skillParams: {}
      }
    );

    // Save initial mastery estimate
    await queries.mastery.upsertMastery(studentId, question.skill_id, {
      masteryProbability: masteryUpdate.masteryProbability,
      theta: masteryUpdate.thetaEstimate,
      timesCorrect: isCorrect ? 1 : 0,
      timesIncorrect: isCorrect ? 0 : 1,
      hintsUsed: 0,
      streak: isCorrect ? 1 : 0,
      lastPracticed: new Date()
    });

    // Store attempt
    await Attempt.create({
      attemptId: uuidv4(),
      sessionId: 'diagnostic',
      studentId,
      questionId,
      skillId: question.skill_id,
      answer: studentAnswer,
      correct: isCorrect,
      timeSpent: timeSpent || 0,
      timestamp: new Date(),
      difficultyLevel: question.difficulty_level
    });
  }

  // Calculate overall performance
  const accuracy = answers.length > 0 ? (totalCorrect / answers.length * 100).toFixed(1) : 0;

  // Generate recommendations
  const recommendations = generateRecommendations(skillResults);

  res.json({
    summary: {
      totalQuestions: answers.length,
      correctAnswers: totalCorrect,
      accuracy,
      diagnosticCompleted: true,
      completedAt: new Date().toISOString()
    },
    skillResults: Object.entries(skillResults).map(([skillId, result]) => ({
      skillId,
      skillName: result.skillName,
      attempts: result.attempts,
      correct: result.correct,
      accuracy: ((result.correct / result.attempts) * 100).toFixed(1)
    })),
    recommendations
  });
}));

/**
 * GET /diagnostic/status
 * Check diagnostic completion status
 */
router.get('/status', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;

  const masteryProfile = await queries.mastery.getStudentMastery(studentId);

  if (masteryProfile.length === 0) {
    return res.json({
      completed: false,
      message: 'Diagnostic not yet completed'
    });
  }

  // Check if any skill has just been initialized (from diagnostic)
  const diagnosticSkills = masteryProfile.filter(m =>
    (m.times_correct + m.times_incorrect) <= 5 &&
    m.last_practiced &&
    (Date.now() - new Date(m.last_practiced).getTime()) < 24 * 60 * 60 * 1000
  );

  res.json({
    completed: diagnosticSkills.length >= 10,
    skillCount: masteryProfile.length,
    canRetake: diagnosticSkills.length === 0
  });
}));

// Helper functions
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function extractOptions(question) {
  const options = [];
  if (question.option_a) options.push({ key: 'A', value: question.option_a });
  if (question.option_b) options.push({ key: 'B', value: question.option_b });
  if (question.option_c) options.push({ key: 'C', value: question.option_c });
  if (question.option_d) options.push({ key: 'D', value: question.option_d });
  return shuffleArray(options);
}

function generateRecommendations(skillResults) {
  const recommendations = [];

  for (const [skillId, result] of Object.entries(skillResults)) {
    const accuracy = (result.correct / result.attempts) * 100;

    if (accuracy < 50) {
      recommendations.push({
        skillId,
        skillName: result.skillName,
        priority: 'high',
        message: `Focus on ${result.skillName} - only ${accuracy.toFixed(0)}% correct`
      });
    } else if (accuracy < 70) {
      recommendations.push({
        skillId,
        skillName: result.skillName,
        priority: 'medium',
        message: `Review ${result.skillName} - ${accuracy.toFixed(0)}% correct`
      });
    }
  }

  return recommendations;
}

async function checkRecentDiagnostic(studentId) {
  const { Attempt } = require('../config/mongo');
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentAttempts = await Attempt.findOne({
    studentId,
    sessionId: 'diagnostic',
    timestamp: { $gte: oneWeekAgo }
  });

  return !!recentAttempts;
}

module.exports = router;