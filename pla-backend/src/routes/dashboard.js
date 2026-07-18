/**
 * Dashboard Routes
 * Student and teacher dashboard data endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../config/logger');
const queries = require('../models/sql/queries');
const { activeSessionsGauge } = require('../config/metrics');

/**
 * GET /dashboard
 * Get student dashboard summary
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;

  // Get mastery statistics
  const masteryStats = await queries.mastery.getMasteryStats(studentId);

  // Get recent sessions
  const recentSessions = await queries.sessions.getStudentSessions(studentId, 5);

  // Get mastery profile for recommendations
  const masteryProfile = await queries.mastery.getStudentMastery(studentId);

  // Calculate overall progress
  const progress = {
    overallMastery: masteryStats?.avg_mastery ? (masteryStats.avg_mastery * 100).toFixed(1) : 0,
    masteredSkills: parseInt(masteryStats?.mastered || 0, 10),
    inProgressSkills: parseInt(masteryStats?.in_progress || 0, 10),
    needsSupportSkills: parseInt(masteryStats?.needs_support || 0, 10),
    totalSessions: recentSessions.length
  };

  // Get recommended skills to practice
  const toPractice = masteryProfile
    .filter(s => s.mastery_probability < 0.8)
    .sort((a, b) => a.mastery_probability - b.mastery_probability)
    .slice(0, 5)
    .map(s => ({
      skillId: s.skill_id,
      skillName: s.skill_name,
      mastery: (s.mastery_probability * 100).toFixed(1),
      priority: s.mastery_probability < 0.5 ? 'high' : 'medium'
    }));

  res.json({
    progress,
    recentSessions: recentSessions.map(s => ({
      sessionId: s.session_id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      questionsAnswered: s.questions_answered,
      accuracy: s.questions_answered > 0
        ? ((s.correct_answers / s.questions_answered) * 100).toFixed(1)
        : 0
    })),
    recommendedPractice: toPractice,
    streak: await getStreak(studentId)
  });
}));

/**
 * GET /dashboard/quick-stats
 * Quick statistics for navbar/header
 */
router.get('/quick-stats', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;

  const masteryStats = await queries.mastery.getMasteryStats(studentId);

  res.json({
    overallMastery: masteryStats?.avg_mastery
      ? (masteryStats.avg_mastery * 100).toFixed(1)
      : 0,
    skillsMastered: parseInt(masteryStats?.mastered || 0, 10),
    activeSessions: await getActiveSessionsCount(studentId)
  });
}));

/**
 * GET /dashboard/recommendations
 * Get personalized recommendations
 */
router.get('/recommendations', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const masteryProfile = await queries.mastery.getStudentMastery(studentId);

  const recommendations = [];

  // Skills that need work
  const weakSkills = masteryProfile
    .filter(s => s.mastery_probability < 0.5)
    .sort((a, b) => a.mastery_probability - b.mastery_probability)
    .slice(0, 3);

  for (const skill of weakSkills) {
    recommendations.push({
      type: 'skill_practice',
      priority: 'high',
      skillId: skill.skill_id,
      skillName: skill.skill_name,
      message: `Focus on ${skill.skill_name} - current mastery: ${(skill.mastery_probability * 100).toFixed(0)}%`
    });
  }

  // Review suggestions
  const skillsToReview = masteryProfile
    .filter(s => s.last_practiced && (Date.now() - new Date(s.last_practiced).getTime()) > 7 * 24 * 60 * 60 * 1000)
    .slice(0, 2);

  for (const skill of skillsToReview) {
    recommendations.push({
      type: 'review',
      priority: 'medium',
      skillId: skill.skill_id,
      skillName: skill.skill_name,
      message: `Time to review ${skill.skill_name}`
    });
  }

  res.json({ recommendations });
}));

// Helper functions
async function getStreak(studentId) {
  // Calculate streak from recent sessions
  const sessions = await queries.sessions.getStudentSessions(studentId, 10);
  let streak = 0;

  for (const session of sessions) {
    if (session.correct_answers && session.questions_answered) {
      const accuracy = session.correct_answers / session.questions_answered;
      if (accuracy >= 0.7) {
        streak++;
      } else {
        break;
      }
    }
  }

  return streak;
}

async function getActiveSessionsCount(studentId) {
  // Count sessions from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessions = await queries.sessions.getStudentSessions(studentId, 100);
  return sessions.filter(s => new Date(s.started_at) >= today).length;
}

module.exports = router;