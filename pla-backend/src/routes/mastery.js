/**
 * Mastery Routes
 * Student mastery profile endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { catchAsync, NotFoundError } = require('../middleware/errorHandler');
const queries = require('../models/sql/queries');
const { predictTimeToMastery } = require('../services/bktService');
const redis = require('../config/redis');

/**
 * GET /mastery
 * Get full mastery profile
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;

  // Check cache first
  const cacheKey = `mastery:${studentId}`;
  const cached = await redis.cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Get mastery profile
  const masteryProfile = await queries.mastery.getStudentMastery(studentId);
  const masteryStats = await queries.mastery.getMasteryStats(studentId);

  // Get modules for organization
  const modules = await queries.curriculum.getModules('Form 1');

  // Organize by module
  const organized = modules.map(module => {
    const moduleSkills = masteryProfile.filter(s => s.module_id === module.module_id);
    return {
      moduleId: module.module_id,
      moduleName: module.module_name,
      sequenceOrder: module.sequence_order,
      skills: moduleSkills.map(s => ({
        skillId: s.skill_id,
        skillName: s.skill_name,
        masteryProbability: s.mastery_probability,
        masteryStatus: getStatus(s.mastery_probability),
        thetaEstimate: s.theta_estimate,
        timesCorrect: s.times_correct,
        timesIncorrect: s.times_incorrect,
        streak: s.streak,
        lastPracticed: s.last_practiced,
        estimatedTimeToMaster: predictTimeToMastery(s.mastery_probability)
      }))
    };
  });

  const result = {
    overall: {
      avgMastery: masteryStats?.avg_mastery ? (masteryStats.avg_mastery * 100).toFixed(1) : 0,
      avgTheta: masteryStats?.avg_theta ? masteryStats.avg_theta.toFixed(2) : 0,
      masteredCount: parseInt(masteryStats?.mastered || 0, 10),
      inProgressCount: parseInt(masteryStats?.in_progress || 0, 10),
      needsSupportCount: parseInt(masteryStats?.needs_support || 0, 10),
      totalSkills: parseInt(masteryStats?.total_skills || 0, 10)
    },
    modules: organized,
    updatedAt: new Date().toISOString()
  };

  // Cache for 5 minutes
  await redis.cache.set(cacheKey, result, 300);

  res.json(result);
}));

/**
 * GET /mastery/:skillId
 * Get mastery for specific skill
 */
router.get('/:skillId', authenticate, catchAsync(async (req, res) => {
  const { skillId } = req.params;
  const studentId = req.user.id;

  const mastery = await queries.mastery.getSkillMastery(studentId, skillId);

  if (!mastery) {
    // Return default mastery for new skill
    return res.json({
      skillId,
      masteryProbability: 0.3,
      masteryStatus: 'critical',
      thetaEstimate: 0,
      timesCorrect: 0,
      timesIncorrect: 0,
      streak: 0,
      lastPracticed: null,
      isNew: true
    });
  }

  res.json({
    skillId: mastery.skill_id,
    masteryProbability: mastery.mastery_probability,
    masteryStatus: getStatus(mastery.mastery_probability),
    thetaEstimate: mastery.theta_estimate,
    abilityLabel: getAbilityLabel(mastery.theta_estimate),
    timesCorrect: mastery.times_correct,
    timesIncorrect: mastery.times_incorrect,
    streak: mastery.streak,
    lastPracticed: mastery.last_practiced,
    estimatedTimeToMaster: predictTimeToMastery(mastery.mastery_probability),
    history: await getSkillHistory(studentId, skillId)
  });
}));

/**
 * GET /mastery/history/:skillId
 * Get practice history for skill
 */
router.get('/history/:skillId', authenticate, catchAsync(async (req, res) => {
  const { skillId } = req.params;
  const studentId = req.user.id;

  const history = await getSkillHistory(studentId, skillId);

  res.json({ history });
}));

// Helper functions
function getStatus(probability) {
  if (probability >= 0.8) return 'mastered';
  if (probability >= 0.5) return 'in_progress';
  if (probability >= 0.3) return 'needs_support';
  return 'critical';
}

function getAbilityLabel(theta) {
  if (theta >= 1.5) return 'Advanced';
  if (theta >= 0.5) return 'Proficient';
  if (theta >= -0.5) return 'Developing';
  if (theta >= -1.5) return 'Foundational';
  return 'Needs Support';
}

async function getSkillHistory(studentId, skillId) {
  try {
    const { Attempt } = require('../config/mongo');
    const attempts = await Attempt.find({ studentId, skillId })
      .sort({ timestamp: -1 })
      .limit(50)
      .select('correct timestamp timeSpent difficultyLevel');

    return attempts.map(a => ({
      date: a.timestamp,
      correct: a.correct,
      timeSpent: a.timeSpent,
      difficulty: a.difficultyLevel
    }));
  } catch (error) {
    return [];
  }
}

module.exports = router;