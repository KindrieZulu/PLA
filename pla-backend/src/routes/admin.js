/**
 * Admin Routes
 * Administrative endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../config/logger');
const postgres = require('../config/postgres');
const mongo = require('../config/mongo');
const { redis } = require('../config/redis');

/**
 * GET /admin/stats
 * System statistics
 */
router.get('/stats', authenticate, requireAdmin, catchAsync(async (req, res) => {
  const stats = {
    database: {
      postgres: await postgres.healthCheck(),
      mongodb: await mongo.healthCheck()
    },
    cache: await require('../config/redis').healthCheck(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };

  res.json(stats);
}));

/**
 * POST /admin/cache/clear
 * Clear application cache
 */
router.post('/cache/clear', authenticate, requireAdmin, catchAsync(async (req, res) => {
  const { pattern = '*' } = req.body;

  if (redis.redis.status === 'ready') {
    await redis.cache.delByPattern(pattern);
  }

  logger.security.sensitiveOperation(req.user.id, 'CACHE_CLEAR', { pattern });

  res.json({ message: 'Cache cleared', pattern });
}));

/**
 * GET /admin/users
 * List all users (admin only)
 */
router.get('/users', authenticate, requireAdmin, catchAsync(async (req, res) => {
  const { page = 1, limit = 50, role } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT student_id, first_name, last_name, username, role, created_at FROM students WHERE deleted_at IS NULL';
  const params = [];

  if (role) {
    query += ' AND role = $1';
    params.push(role);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit, 10), offset);

  const result = await postgres.query(query, params);

  res.json({
    users: result.rows,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    }
  });
}));

/**
 * POST /admin/maintenance
 * Toggle maintenance mode
 */
router.post('/maintenance', authenticate, requireAdmin, catchAsync(async (req, res) => {
  const { enabled, message } = req.body;

  process.env.MAINTENANCE_MODE = enabled ? 'true' : 'false';

  logger.security.sensitiveOperation(req.user.id, 'MAINTENANCE_MODE', { enabled, message });

  res.json({
    maintenanceMode: enabled,
    message: message || 'System maintenance mode toggled'
  });
}));

module.exports = router;