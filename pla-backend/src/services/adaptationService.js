/**
 * Adaptation Service
 * Question selection logic based on BKT + IRT mastery estimates
 */

const logger = require('../config/logger');
const { getZPDDifficulty } = require('./bktService');
const queries = require('../models/sql/queries');

// Cache for recently used questions (prevent repetition)
const recentQuestionsCache = new Map();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Select the next adaptive question for a student
 */
async function selectNextQuestion(studentId, sessionId, masteryProfile) {
  const startTime = Date.now();

  // Get recently used questions for this student (within last hour)
  const recentQuestions = getRecentQuestions(studentId);

  // Find skills that need practice
  const skillsToPractice = identifySkillsToPractice(masteryProfile);

  if (skillsToPractice.length === 0) {
    logger.warn('No skills to practice', { studentId });
    return null;
  }

  // Select a skill based on priority
  const selectedSkill = selectSkillByPriority(skillsToPractice);

  // Get student's current ability estimate
  const avgTheta = calculateAverageTheta(masteryProfile);

  // Determine target difficulty (ZPD)
  const targetDifficulty = getZPDDifficulty(avgTheta);

  // Try to find a question at the target difficulty
  let question = await findQuestion(selectedSkill.skillId, targetDifficulty, recentQuestions);

  // Fallback to any difficulty if target not available
  if (!question) {
    question = await findQuestion(selectedSkill.skillId, null, recentQuestions);
  }

  if (!question) {
    logger.warn('No questions available', {
      skillId: selectedSkill.skillId,
      difficulty: targetDifficulty
    });
    return null;
  }

  // Track recently used questions
  trackRecentQuestion(studentId, question.question_id);

  const selectionTime = Date.now() - startTime;
  logger.debug('Question selected', {
    questionId: question.question_id,
    skillId: question.skill_id,
    difficulty: question.difficulty_level,
    selectionTime: `${selectionTime}ms`
  });

  return {
    question: sanitizeQuestion(question),
    skill: selectedSkill,
    recommendedDifficulty: targetDifficulty
  };
}

/**
 * Identify skills that need practice based on mastery profile
 */
function identifySkillsToPractice(masteryProfile) {
  if (!masteryProfile || masteryProfile.length === 0) {
    return [];
  }

  return masteryProfile
    .filter(skill => {
      // Skills below mastery threshold need practice
      if (skill.mastery_probability < 0.8) return true;
      // Skills not practiced recently
      if (skill.last_practiced) {
        const daysSince = (Date.now() - new Date(skill.last_practiced).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 3;
      }
      return true;
    })
    .map(skill => ({
      skillId: skill.skill_id,
      skillName: skill.skill_name,
      masteryProbability: skill.mastery_probability,
      lastPracticed: skill.last_practiced,
      priority: calculateSkillPriority(skill)
    }))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Calculate priority for a skill
 */
function calculateSkillPriority(skill) {
  let priority = 0;

  // Lower mastery = higher priority
  priority += (1 - skill.mastery_probability) * 50;

  // Not practiced recently = higher priority
  if (skill.last_practiced) {
    const daysSince = (Date.now() - new Date(skill.last_practiced).getTime()) / (1000 * 60 * 60 * 24);
    priority += Math.min(daysSince, 7); // Cap at 7 days bonus
  } else {
    priority += 5; // Never practiced
  }

  // Has prerequisite that's mastered = higher priority
  if (skill.prerequisite_mastery >= 0.8) {
    priority += 3;
  }

  return priority;
}

/**
 * Select skill by priority with some randomization
 */
function selectSkillByPriority(skills) {
  if (skills.length === 0) return null;

  // Add some randomization to prevent always picking highest priority
  const weights = skills.map(s => Math.pow(2, s.priority));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < skills.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return skills[i];
    }
  }

  return skills[0];
}

/**
 * Calculate average theta from mastery profile
 */
function calculateAverageTheta(masteryProfile) {
  if (!masteryProfile || masteryProfile.length === 0) return 0;

  const thetas = masteryProfile.filter(m => m.theta_estimate !== null).map(m => m.theta_estimate);

  if (thetas.length === 0) return 0;

  return thetas.reduce((sum, t) => sum + t, 0) / thetas.length;
}

/**
 * Find a question matching criteria
 */
async function findQuestion(skillId, difficulty, excludeQuestionIds) {
  try {
    let questions;

    if (difficulty) {
      questions = await queries.questions.getByDifficulty(skillId, difficulty, 10);
    } else {
      questions = await queries.questions.getBySkill(skillId, 10);
    }

    if (!questions || questions.length === 0) return null;

    // Filter out recently used questions
    const available = questions.filter(q => !excludeQuestionIds.includes(q.question_id));

    if (available.length > 0) {
      // Return random question from available
      return available[Math.floor(Math.random() * available.length)];
    }

    // If all filtered out, return any question
    return questions[Math.floor(Math.random() * questions.length)];
  } catch (error) {
    logger.error('Failed to find question', { error: error.message, skillId, difficulty });
    return null;
  }
}

/**
 * Get recently used questions for a student
 */
function getRecentQuestions(studentId) {
  const key = `recent:${studentId}`;
  const cached = recentQuestionsCache.get(key);

  if (!cached) return [];

  // Filter out expired entries
  const now = Date.now();
  return cached.filter(entry => now - entry.timestamp < CACHE_TTL).map(entry => entry.questionId);
}

/**
 * Track recently used question
 */
function trackRecentQuestion(studentId, questionId) {
  const key = `recent:${studentId}`;

  let entries = recentQuestionsCache.get(key) || [];

  // Add new entry
  entries.push({
    questionId,
    timestamp: Date.now()
  });

  // Keep only recent entries (last 20)
  entries = entries.slice(-20);

  recentQuestionsCache.set(key, entries);
}

/**
 * Sanitize question for client (hide correct answer)
 */
function sanitizeQuestion(question) {
  return {
    question_id: question.question_id,
    skill_id: question.skill_id,
    skill_name: question.skill_name,
    question_title: question.question_title,
    question_text: question.question_text,
    question_type: question.question_type,
    difficulty_level: question.difficulty_level,
    hint_1: question.hint_1 || null,
    hint_2: question.hint_2 || null,
    options: extractOptions(question),
    // Do NOT expose correct_answer to client
  };
}

/**
 * Extract options from question (remove correct indicator)
 */
function extractOptions(question) {
  // Questions could have options in various formats
  // This extracts and randomizes them for the client
  const options = [];

  if (question.option_a) options.push({ key: 'A', value: question.option_a });
  if (question.option_b) options.push({ key: 'B', value: question.option_b });
  if (question.option_c) options.push({ key: 'C', value: question.option_c });
  if (question.option_d) options.push({ key: 'D', value: question.option_d });

  // Shuffle options for client
  return shuffleArray(options);
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Get session statistics
 */
async function getSessionStats(sessionId, studentId) {
  try {
    const session = await queries.sessions.getById(sessionId);

    if (!session) return null;

    return {
      sessionId,
      studentId,
      duration: session.duration,
      questionsAnswered: session.questions_answered,
      correctAnswers: session.correct_answers,
      accuracy: session.questions_answered > 0
        ? (session.correct_answers / session.questions_answered * 100).toFixed(1)
        : 0,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      status: session.status
    };
  } catch (error) {
    logger.error('Failed to get session stats', { error: error.message, sessionId });
    return null;
  }
}

/**
 * Recommend next learning path
 */
async function recommendLearningPath(studentId, masteryProfile) {
  const path = [];

  // Find skills needing work
  const needsWork = masteryProfile.filter(m => m.mastery_probability < 0.8);

  // Sort by priority
  needsWork.sort((a, b) => a.mastery_probability - b.mastery_probability);

  // Recommend top 5 skills
  for (const skill of needsWork.slice(0, 5)) {
    path.push({
      skillId: skill.skill_id,
      skillName: skill.skill_name,
      currentMastery: skill.mastery_probability,
      targetMastery: 0.8,
      estimatedTime: predictTimeToReach(skill.mastery_probability, 0.8)
    });
  }

  return path;
}

/**
 * Predict time to reach target mastery
 */
function predictTimeToReach(current, target) {
  const gap = target - current;
  if (gap <= 0) return '0 sessions';

  // Rough estimate: each session = 10 questions
  const questionsNeeded = Math.ceil(gap / 0.15); // ~15% gain per session
  const sessions = Math.ceil(questionsNeeded / 10);

  return `${sessions} session${sessions > 1 ? 's' : ''}`;
}

module.exports = {
  selectNextQuestion,
  identifySkillsToPractice,
  getRecentQuestions,
  getSessionStats,
  recommendLearningPath,
  sanitizeQuestion
};