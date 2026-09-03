/**
 * BKT (Bayesian Knowledge Tracing) Service
 * Adaptive learning mastery engine
 * Combines BKT with IRT (Item Response Theory) for improved adaptation
 */

const logger = require('../config/logger');
const { dbQueryDuration } = require('../config/metrics');

// Default BKT parameters (can be overridden per skill)
const DEFAULT_BKT_PARAMS = {
  prior: 0.30,    // P(L0) - Initial probability of knowing
  learn: 0.20,    // P(T) - Probability of learning on a trial
  slip: 0.10,     // P(S) - Probability of slipping (knowing but wrong)
  guess: 0.20     // P(G) - Probability of guessing correctly when unknown
};

// Mastery thresholds
const MASTERY_THRESHOLDS = {
  mastered: 0.80,      // 80%+ probability = mastered
  inProgress: 0.50,    // 50-79% = in progress
  needsSupport: 0.30,  // 30-49% = needs support
  critical: 0.30       // <30% = critical gap
};

// Mastery status labels
const MASTERY_STATUS = {
  mastered: 'mastered',
  inProgress: 'in_progress',
  needsSupport: 'needs_support',
  critical: 'critical'
};

/**
 * Update BKT mastery probability
 * @param {Object} previousMastery - Previous mastery state
 * @param {Boolean} isCorrect - Whether the answer was correct
 * @param {Number} hintUsed - Number of hints used
 * @param {Object} skillParams - BKT parameters for this skill
 * @param {Number} responseTimeSeconds - Time spent on question
 * @param {String} difficultyLevel - Easy/Medium/Hard
 * @param {Number} streak - Consecutive correct answers
 * @param {Number} tryCount - Number of attempts on this question
 * @returns {Object} Updated mastery state
 */
function updateBKT(previousMastery, isCorrect, hintUsed = 0, skillParams = {}, responseTimeSeconds = 0, difficultyLevel = 'Medium', streak = 0, tryCount = 1) {
  const startTime = Date.now();

  // Merge skill-specific params with defaults
  const params = { ...DEFAULT_BKT_PARAMS, ...skillParams };

  // Get previous mastery probability
  const prevP = previousMastery?.masteryProbability || params.prior;

  // Base BKT calculations
  let pLearn = params.learn; // P(T) - learning probability

  // Apply hint penalty (reduces effective learning)
  if (hintUsed > 0) {
    pLearn *= Math.pow(0.7, hintUsed); // Each hint reduces learning by 30%
  }

  // Calculate new mastery probability
  let newMastery;

  if (isCorrect) {
    // Correct answer: increase mastery
    // P(L_new) = P(L_old) + P(T) * (1 - P(L_old))
    newMastery = prevP + pLearn * (1 - prevP);
  } else {
    // Incorrect answer: decrease mastery
    // Could be slip or truly don't know
    // P(L_new) = P(L_old) * (1 - P(S)) / [P(L_old) * (1 - P(S)) + (1 - P(L_old)) * P(G)]
    const slip = params.slip * tryCount; // Increase slip probability with attempts
    const numerator = prevP * (1 - slip);
    const denominator = prevP * (1 - slip) + (1 - prevP) * params.guess;
    newMastery = denominator > 0 ? numerator / denominator : prevP * 0.9;
  }

  // Apply modifiers based on response time and difficulty
  newMastery = applyModifiers(newMastery, isCorrect, responseTimeSeconds, difficultyLevel, streak);

  // Clamp to valid range [0.05, 0.98]
  newMastery = Math.max(0.05, Math.min(0.98, newMastery));

  // Determine mastery status
  const status = getMasteryStatus(newMastery);

  // Calculate time since last practice
  const lastPracticed = previousMastery?.lastPracticed || new Date();
  const timeSinceLast = (Date.now() - new Date(lastPracticed).getTime()) / (1000 * 60 * 60); // hours

  // Apply decay for inactive skills (optional)
  if (timeSinceLast > 24) {
    const decayFactor = Math.exp(-0.01 * (timeSinceLast - 24)); // 1% decay per hour after 24h
    newMastery = Math.max(0.05, newMastery * decayFactor);
  }

  // Track query duration
  const duration = Date.now() - startTime;
  dbQueryDuration.observe({ db_type: 'bkt', operation: 'update', table: 'mastery' }, duration / 1000);

  logger.debug('BKT update calculated', {
    prevMastery: prevP,
    newMastery,
    isCorrect,
    status
  });

  return {
    masteryProbability: newMastery,
    masteryStatus: status,
    bktDetail: {
      params,
      prevP,
      pLearn,
      hintPenalty: hintUsed > 0 ? Math.pow(0.7, hintUsed) : 1,
      responseTimeBonus: getResponseTimeBonus(responseTimeSeconds, isCorrect, difficultyLevel),
      streakBonus: getStreakBonus(streak),
      timeDecay: timeSinceLast > 24 ? Math.exp(-0.01 * (timeSinceLast - 24)) : 1
    }
  };
}

/**
 * Apply response time and difficulty modifiers
 */
function applyModifiers(mastery, isCorrect, responseTime, difficulty, streak) {
  let modified = mastery;

  // Fast correct answer bonus
  if (isCorrect && responseTime > 0) {
    const expectedTime = getExpectedTime(difficulty);
    if (responseTime < expectedTime * 0.5) {
      modified += 0.02; // Very fast - small bonus
    } else if (responseTime < expectedTime) {
      modified += 0.01; // Faster than expected
    } else if (responseTime > expectedTime * 2) {
      modified -= 0.01; // Very slow - small penalty
    }
  }

  // Streak bonus (caps at 0.05)
  if (isCorrect && streak >= 3) {
    modified += Math.min(0.05, streak * 0.01);
  }

  return Math.max(0.05, Math.min(0.98, modified));
}

/**
 * Get expected time for difficulty level (in seconds)
 */
function getExpectedTime(difficulty) {
  const times = {
    Easy: 30,
    Medium: 60,
    Hard: 120
  };
  return times[difficulty] || 60;
}

/**
 * Get response time bonus/penalty
 */
function getResponseTimeBonus(responseTime, isCorrect, difficulty) {
  if (responseTime === 0) return 0;

  const expected = getExpectedTime(difficulty);
  const ratio = responseTime / expected;

  if (isCorrect) {
    if (ratio < 0.5) return 0.02;   // Very fast
    if (ratio < 1.0) return 0.01;   // Fast
    if (ratio > 2.0) return -0.01;  // Very slow
  } else {
    if (ratio < 0.5) return -0.02;  // Very fast but wrong = guessed
    if (ratio > 2.0) return 0.01;   // Slow but wrong = tried hard
  }

  return 0;
}

/**
 * Get streak bonus
 */
function getStreakBonus(streak) {
  if (streak >= 10) return 0.05;
  if (streak >= 5) return 0.03;
  if (streak >= 3) return 0.01;
  return 0;
}

/**
 * Determine mastery status from probability
 */
function getMasteryStatus(probability) {
  if (probability >= MASTERY_THRESHOLDS.mastered) return MASTERY_STATUS.mastered;
  if (probability >= MASTERY_THRESHOLDS.inProgress) return MASTERY_STATUS.inProgress;
  if (probability >= MASTERY_THRESHOLDS.needsSupport) return MASTERY_STATUS.needsSupport;
  return MASTERY_STATUS.critical;
}

/**
 * IRT (Item Response Theory) 2-Parameter Logistic Model
 * Updates ability estimate (theta) based on responses
 */
function updateIRTAbility(theta, isCorrect, difficultyLevel) {
  // Difficulty parameter (b) based on level
  const difficultyMap = {
    Easy: -1.0,
    Medium: 0.0,
    Hard: 1.0
  };
  const b = difficultyMap[difficultyLevel] || 0;

  // Ability parameter (a) - discrimination
  const a = 1.0; // Default discrimination

  // Calculate probability of correct response given theta
  const exponent = -a * (theta - b);
  const pCorrect = 1 / (1 + Math.exp(exponent));

  // Update theta using EAP-style approximation
  const learningRate = 0.3;
  const observed = isCorrect ? 1 : 0;
  const thetaNew = theta + learningRate * (observed - pCorrect);

  // Clamp theta to range [-3, +3]
  const thetaClamped = Math.max(-3, Math.min(3, thetaNew));

  // Map theta to ability label
  const abilityLabel = getAbilityLabel(thetaClamped);

  return {
    thetaNew: thetaClamped,
    pCorrect: pCorrect.toFixed(4),
    thetaEstimate: thetaClamped,
    abilityLabel,
    irtDetail: {
      a,
      b,
      pCorrect,
      observed: isCorrect ? 1 : 0,
      update: learningRate * (observed - pCorrect)
    }
  };
}

/**
 * Get ability label from theta
 */
function getAbilityLabel(theta) {
  if (theta >= 1.5) return 'Advanced';
  if (theta >= 0.5) return 'Proficient';
  if (theta >= -0.5) return 'Developing';
  if (theta >= -1.5) return 'Foundational';
  return 'Needs Support';
}

/**
 * Select difficulty based on theta (Zone of Proximal Development)
 * Target P(correct) ≈ 0.65
 */
function getZPDDifficulty(theta) {
  // For P = 0.65, we need b such that theta - b ≈ -0.4
  // Therefore: b ≈ theta + 0.4
  const targetThetaDiff = -0.4;
  const impliedB = theta - targetThetaDiff;

  if (impliedB <= -0.5) return 'Easy';
  if (impliedB <= 0.5) return 'Medium';
  return 'Hard';
}

/**
 * Combined BKT + IRT update
 */
function updateCombinedMastery(previousState, attemptData) {
  const { isCorrect, hintUsed, responseTime, difficulty, streak, tryCount, skillParams } = attemptData;

  // BKT update
  const bktResult = updateBKT(
    previousState,
    isCorrect,
    hintUsed,
    skillParams,
    responseTime,
    difficulty,
    streak,
    tryCount
  );

  // IRT update
  const theta = previousState?.thetaEstimate || 0;
  const irtResult = updateIRTAbility(theta, isCorrect, difficulty);

  return {
    masteryProbability: bktResult.masteryProbability,
    masteryStatus: bktResult.masteryStatus,
    thetaEstimate: irtResult.thetaNew,
    abilityLabel: irtResult.abilityLabel,
    bktDetail: bktResult.bktDetail,
    irtDetail: irtResult.irtDetail,
    isCorrect
  };
}

/**
 * Calculate predicted time to master a skill
 */
function predictTimeToMastery(currentMastery, targetMastery = 0.8) {
  if (currentMastery >= targetMastery) {
    return { hours: 0, sessions: 0, estimated: false };
  }

  const gap = targetMastery - currentMastery;
  const learnRate = 0.20; // Base learning rate

  // Estimate sessions needed (assuming 10 questions per session)
  const questionsNeeded = Math.ceil(gap / learnRate);
  const sessionsNeeded = Math.ceil(questionsNeeded / 10);

  // Estimate hours (assuming 20 minutes per session)
  const hoursNeeded = sessionsNeeded * (20 / 60);

  return {
    hours: Math.round(hoursNeeded * 10) / 10,
    sessions: sessionsNeeded,
    questions: questionsNeeded,
    estimated: true
  };
}

module.exports = {
  updateBKT,
  updateIRTAbility,
  updateCombinedMastery,
  getMasteryStatus,
  getZPDDifficulty,
  getAbilityLabel,
  predictTimeToMastery,
  MASTERY_THRESHOLDS,
  MASTERY_STATUS,
  DEFAULT_BKT_PARAMS
};