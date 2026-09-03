/**
 * V1 API Routes
 * Main API router mounting all route modules
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const sessionRoutes = require('./session');
const questionRoutes = require('./question');
const attemptRoutes = require('./attempt');
const masteryRoutes = require('./mastery');
const materialRoutes = require('./material');
const diagnosticRoutes = require('./diagnostic');
const teacherRoutes = require('./teacher');
const adminRoutes = require('./admin');
const virtualTARoutes = require('./virtualTA');
const olmRoutes = require('./olm');

// Mount routes
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/sessions', sessionRoutes);
router.use('/questions', questionRoutes);
router.use('/attempts', attemptRoutes);
router.use('/mastery', masteryRoutes);
router.use('/materials', materialRoutes);
router.use('/diagnostic', diagnosticRoutes);
router.use('/teacher', teacherRoutes);
router.use('/admin', adminRoutes);
router.use('/virtualTA', virtualTARoutes);
router.use('/olm', olmRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    title: 'PLA API v1 Documentation',
    version: '1.0.0',
    basePath: '/api/v1',
    endpoints: {
      auth: {
        'POST /auth/login': 'Authenticate user',
        'POST /auth/register': 'Register new student',
        'POST /auth/refresh': 'Refresh access token',
        'POST /auth/logout': 'Logout and revoke tokens'
      },
      dashboard: {
        'GET /dashboard': 'Get student dashboard data'
      },
      sessions: {
        'GET /sessions': 'List student sessions',
        'POST /sessions': 'Start new session',
        'GET /sessions/:id': 'Get session details',
        'POST /sessions/:id/end': 'End session'
      },
      questions: {
        'GET /questions/adaptive': 'Get next adaptive question',
        'GET /questions/:id': 'Get question details'
      },
      attempts: {
        'POST /attempts': 'Submit answer attempt',
        'POST /attempts/bulk': 'Bulk sync offline attempts'
      },
      mastery: {
        'GET /mastery': 'Get mastery profile',
        'GET /mastery/:skillId': 'Get specific skill mastery'
      },
      materials: {
        'GET /materials': 'Get reading materials',
        'GET /materials/:id': 'Get specific material'
      },
      diagnostic: {
        'GET /diagnostic/questions': 'Get diagnostic test questions',
        'POST /diagnostic/submit': 'Submit diagnostic results'
      },
      teacher: {
        'GET /teacher/students': 'List teacher\'s students',
        'GET /teacher/students/:id': 'Get student details',
        'GET /teacher/class-overview': 'Get class overview'
      },
      virtualTA: {
        'POST /virtualTA/query': 'Query Virtual Teaching Assistant'
      },
      olm: {
        'GET /olm': 'Get Open Learner Model'
      }
    },
    rateLimits: {
      global: '300 requests per 15 minutes',
      auth: '10 requests per 15 minutes',
      admin: '30 requests per minute'
    },
    authentication: 'Bearer token in Authorization header'
  });
});

module.exports = router;