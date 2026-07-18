/**
 * OLM (Open Learner Model) Routes
 * Full transparency of the learner model
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { catchAsync } = require('../middleware/errorHandler');
const queries = require('../models/sql/queries');

/**
 * GET /olm
 * Get full Open Learner Model
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;

  // Get mastery stats
  const stats = await queries.mastery.getMasteryStats(studentId);

  // Get full mastery profile
  const profile = await queries.mastery.getStudentMastery(studentId);

  // Get modules
  const modules = await queries.curriculum.getModules('Form 1');

  // Calculate ability metrics
  const avgTheta = stats?.avg_theta || 0;
  const abilityLabel = getAbilityLabel(avgTheta);
  const abilityDescription = getAbilityDescription(avgTheta);

  // Calculate progress metrics
  const totalSkills = parseInt(stats?.total_skills || 0, 10);
  const masteredSkills = parseInt(stats?.mastered || 0, 10);
  const overallPercent = totalSkills > 0 ? ((masteredSkills / totalSkills) * 100).toFixed(1) : 0;

  // Get active module (lowest mastered skill)
  const activeModule = findActiveModule(profile, modules);

  // Predict sessions needed
  const predictedSessions = predictSessionsNeeded(masteredSkills, totalSkills);

  // Organize skills by module
  const modulesWithSkills = modules.map(module => {
    const moduleSkills = profile.filter(s => s.module_id === module.module_id);
    return {
      moduleId: module.module_id,
      moduleName: module.module_name,
      mastered: moduleSkills.filter(s => s.mastery_probability >= 0.8).length,
      inProgress: moduleSkills.filter(s => s.mastery_probability >= 0.5 && s.mastery_probability < 0.8).length,
      needsSupport: moduleSkills.filter(s => s.mastery_probability < 0.5).length,
      avgMastery: moduleSkills.length > 0
        ? (moduleSkills.reduce((sum, s) => sum + s.mastery_probability, 0) / moduleSkills.length * 100).toFixed(1)
        : 0
    };
  });

  res.json({
    ability: {
      theta: avgTheta.toFixed(2),
      label: abilityLabel,
      description: abilityDescription,
      color: getAbilityColor(avgTheta)
    },
    curriculum: {
      overallPercent,
      masteredSkills,
      activeModule,
      predictedSessions
    },
    modules: modulesWithSkills,
    skills: profile.map(s => ({
      skillId: s.skill_id,
      skillName: s.skill_name,
      mastery: (s.mastery_probability * 100).toFixed(1),
      status: getMasteryStatus(s.mastery_probability),
      theta: s.theta_estimate?.toFixed(2) || '0.00',
      lastPracticed: s.last_practiced
    })),
    generatedAt: new Date().toISOString()
  });
}));

function getAbilityLabel(theta) {
  if (theta >= 1.5) return 'Advanced';
  if (theta >= 0.5) return 'Proficient';
  if (theta >= -0.5) return 'Developing';
  if (theta >= -1.5) return 'Foundational';
  return 'Needs Support';
}

function getAbilityDescription(theta) {
  const descriptions = {
    'Advanced': 'You demonstrate strong understanding and can apply concepts in complex situations.',
    'Proficient': 'You have a solid grasp of the material and can solve most problems correctly.',
    'Developing': 'You\'re building your understanding and can handle straightforward problems.',
    'Foundational': 'You\'re starting to learn these concepts and building basic skills.',
    'Needs Support': 'Additional practice and support will help build your understanding.'
  };
  return descriptions[getAbilityLabel(theta)];
}

function getAbilityColor(theta) {
  if (theta >= 1.5) return '#10b981'; // Green
  if (theta >= 0.5) return '#3b82f6'; // Blue
  if (theta >= -0.5) return '#f59e0b'; // Yellow
  if (theta >= -1.5) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

function getMasteryStatus(probability) {
  if (probability >= 0.8) return 'mastered';
  if (probability >= 0.5) return 'in_progress';
  return 'needs_support';
}

function findActiveModule(profile, modules) {
  // Find module with lowest average mastery
  const moduleAverages = modules.map(module => {
    const skills = profile.filter(s => s.module_id === module.module_id);
    const avg = skills.length > 0
      ? skills.reduce((sum, s) => sum + s.mastery_probability, 0) / skills.length
      : 0;
    return { module, avg };
  });

  const weakest = moduleAverages.sort((a, b) => a.avg - b.avg)[0];
  return weakest?.module?.module_name || 'Getting Started';
}

function predictSessionsNeeded(mastered, total) {
  // Rough estimate: each session covers ~5 new concepts
  const remaining = total - mastered;
  return Math.ceil(remaining / 5);
}

module.exports = router;