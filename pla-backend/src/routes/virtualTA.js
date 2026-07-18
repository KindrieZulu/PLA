/**
 * Virtual TA Routes
 * Rule-based teaching assistant
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { catchAsync } = require('../middleware/errorHandler');
const queries = require('../models/sql/queries');

// Intent patterns for classification
const INTENT_PATTERNS = {
  hint: /\b(hint|help|stuck|don't know|confused|how do I|what should I)\b/i,
  explain: /\b(explain|what is|meaning|define|tell me about|describe)\b/i,
  example: /\b(example|show me|give me an|like when|demonstrate)\b/i,
  answer: /\b(answer|solution|answer is|what's the answer|give me the)\b/i,
  progress: /\b(progress|mastery|how am I|doing|skill|improving)\b/i,
  next_step: /\b(next|what to do|should I|continue|next step|what comes)\b/i,
  encourage: /\b(good job|well done|awesome|great|nice work|encourage)\b/i,
  greet: /\b(hi|hello|hey|good morning|good afternoon|greetings)\b/i
};

/**
 * POST /virtualTA/query
 * Process Virtual TA query
 */
router.post('/query', authenticate, catchAsync(async (req, res) => {
  const { message, skillId, questionId } = req.body;
  const studentId = req.user.id;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Message is required'
    });
  }

  // Classify intent
  const intent = classifyIntent(message);

  // Generate response based on intent
  let response;

  switch (intent) {
    case 'hint':
      response = await generateHint(studentId, skillId, questionId);
      break;
    case 'explain':
      response = await generateExplanation(studentId, skillId, questionId);
      break;
    case 'example':
      response = await generateExample(studentId, skillId);
      break;
    case 'progress':
      response = await generateProgress(studentId);
      break;
    case 'next_step':
      response = await generateNextStep(studentId, skillId);
      break;
    case 'encourage':
      response = generateEncouragement();
      break;
    case 'greet':
      response = generateGreeting(studentId);
      break;
    default:
      response = generateGeneralResponse();
  }

  res.json({
    reply: response.text,
    type: response.type,
    suggestions: response.suggestions || [],
    skillId,
    intent
  });
}));

/**
 * GET /virtualTA/history
 * Get conversation history
 */
router.get('/history', authenticate, catchAsync(async (req, res) => {
  const { ChatLog } = require('../config/mongo');
  const studentId = req.user.id;

  const chats = await ChatLog.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('chatId messages createdAt resolved');

  res.json({ history: chats });
}));

function classifyIntent(message) {
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(message)) {
      return intent;
    }
  }
  return 'general';
}

async function generateHint(studentId, skillId, questionId) {
  if (questionId) {
    const question = await queries.questions.getById(questionId);
    if (question) {
      const hints = [question.hint_1, question.hint_2].filter(Boolean);
      if (hints.length > 0) {
        return {
          text: `Here's a hint: ${hints[0]}`,
          type: 'hint',
          suggestions: ['I understand', 'Show me more', 'Let me try']
        };
      }
    }
  }

  if (skillId) {
    const skill = await queries.curriculum.getSkillWithPrerequisites(skillId);
    if (skill) {
      return {
        text: `For ${skill.skill_name}, try breaking the problem into smaller steps. What information do you have? What are you trying to find?`,
        type: 'hint',
        suggestions: ['I need more help', 'Show me an example', 'Let me try']
      };
    }
  }

  return {
    text: "I can help! First, let me know what specific concept you're working with. You can share the question or skill you're practicing.",
    type: 'hint',
    suggestions: ['I\'m on a question', 'I want to practice a skill', 'I\'m stuck on a concept']
  };
}

async function generateExplanation(studentId, skillId, questionId) {
  if (skillId) {
    const skill = await queries.curriculum.getSkillWithPrerequisites(skillId);
    if (skill && skill.explanation) {
      return {
        text: skill.explanation,
        type: 'explanation',
        suggestions: ['Show me an example', 'Give me a hint', 'Let me try']
      };
    }
  }

  // Get reading materials
  if (skillId) {
    const materials = await getReadingMaterials(studentId, skillId);
    if (materials.length > 0) {
      return {
        text: `I have some reading materials that explain this concept. Would you like me to show you "${materials[0].title}"?`,
        type: 'explanation',
        suggestions: ['Yes, show me', 'Give me a quick explanation', 'I want to practice']
      };
    }
  }

  return {
    text: "Let me help you understand! Can you tell me which specific concept or question you'd like me to explain?",
    type: 'explanation',
    suggestions: ['I\'m on a question', 'Show me a concept', 'Give me an example']
  };
}

async function generateExample(studentId, skillId) {
  if (skillId) {
    // Get a practice question as example
    const questions = await queries.questions.getBySkill(skillId, 5);
    if (questions.length > 0) {
      const example = questions[0];
      return {
        text: `Here's an example of a similar question:\n\n"${example.question_text}"\n\nThis will help you understand the concept. Try solving it!`,
        type: 'example',
        suggestions: ['I want more examples', 'Let me practice', 'Show me the answer']
      };
    }
  }

  return {
    text: "I can show you examples! Which skill or topic would you like an example for?",
    type: 'example',
    suggestions: ['Numbers and algebra', 'Geometry', 'Statistics', 'Measurement']
  };
}

async function generateProgress(studentId) {
  const stats = await queries.mastery.getMasteryStats(studentId);
  const profile = await queries.mastery.getStudentMastery(studentId);

  if (!stats || profile.length === 0) {
    return {
      text: "You haven't completed the diagnostic test yet. Take the diagnostic to see your progress!",
      type: 'progress',
      suggestions: ['Take diagnostic test', 'Practice some questions', 'View my mastery map']
    };
  }

  const mastered = parseInt(stats.mastered || 0, 10);
  const inProgress = parseInt(stats.in_progress || 0, 10);
  const avgMastery = (stats.avg_mastery * 100).toFixed(1);

  return {
    text: `You're doing great! You have ${mastered} mastered skills and ${inProgress} skills in progress. Your overall mastery is at ${avgMastery}%. Keep up the good work!`,
    type: 'progress',
    suggestions: ['Show me my skills', 'What should I work on?', 'I want to practice']
  };
}

async function generateNextStep(studentId, skillId) {
  const profile = await queries.mastery.getStudentMastery(studentId);

  if (profile.length === 0) {
    return {
      text: "Start with the diagnostic test to find out where to begin!",
      type: 'next_step',
      suggestions: ['Take diagnostic', 'What skills exist?', 'Help me']
    };
  }

  // Find skills that need work
  const weakSkills = profile
    .filter(s => s.mastery_probability < 0.7)
    .sort((a, b) => a.mastery_probability - b.mastery_probability)
    .slice(0, 3);

  if (weakSkills.length > 0) {
    const skill = weakSkills[0];
    return {
      text: `I recommend working on "${skill.skill_name}" next. Your mastery there is at ${(skill.mastery_probability * 100).toFixed(0)}%. Let's practice!`,
      type: 'next_step',
      suggestions: ['Start practicing', 'Show me all weak skills', 'Continue with current topic']
    };
  }

  return {
    text: "You're doing well! Keep practicing to maintain your skills and challenge yourself with harder questions.",
    type: 'next_step',
    suggestions: ['I want harder questions', 'Review mastered skills', 'Take a break']
  };
}

function generateEncouragement() {
  const messages = [
    "You're doing great! Keep up the fantastic work! 🌟",
    "Wonderful progress! Every question you attempt helps you learn! 💪",
    "Great effort! Remember, making mistakes is part of learning. Keep going!",
    "You're on the right track! Your dedication is paying off! 🎯"
  ];
  return {
    text: messages[Math.floor(Math.random() * messages.length)],
    type: 'encouragement',
    suggestions: ['Thank you!', 'I want to practice', 'Show my progress']
  };
}

function generateGreeting(studentId) {
  const hour = new Date().getHours();
  let greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return {
    text: `${greeting}! I'm your Virtual TA. I can help you with hints, explanations, and track your progress. What would you like help with today?`,
    type: 'greeting',
    suggestions: ['I need a hint', 'Explain a concept', 'Show my progress', 'Help me with a question']
  };
}

function generateGeneralResponse() {
  return {
    text: "I'm here to help! I can assist with hints, explanations, examples, and track your learning progress. What would you like to work on?",
    type: 'general',
    suggestions: ['Give me a hint', 'Explain something', 'Show my progress', 'Help with a question']
  };
}

async function getReadingMaterials(studentId, skillId) {
  try {
    // This would query reading_materials table
    return [];
  } catch {
    return [];
  }
}

module.exports = router;