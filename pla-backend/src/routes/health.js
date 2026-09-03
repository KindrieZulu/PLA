/**
 * Health Check Routes
 * System health and readiness endpoints
 * Supports Render health checks + Kubernetes probes
 */

const express = require('express');
const router = express.Router();
const postgres = require('../config/postgres');
const { redis, healthCheck: redisHealthCheck } = require('../config/redis');

/**
 * GET /health
 * Basic health check — Render uses this for its healthCheckPath
 * Always returns 200 if the process is running
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'pla-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /health/ready
 * Readiness check — verifies critical dependencies are available
 * Used by Kubernetes readiness probes
 */
router.get('/health/ready', async (req, res) => {
  const checks = {};
  let allHealthy = true;

  // Check PostgreSQL (critical)
  try {
    const pgHealth = await postgres.healthCheck();
    checks.postgres = pgHealth;
    if (pgHealth.status !== 'healthy') allHealthy = false;
  } catch (error) {
    checks.postgres = { status: 'unhealthy', error: error.message };
    allHealthy = false;
  }

  // Check MongoDB (optional — app runs without it)
  try {
    const mongo = require('../config/mongo');
    if (mongo.healthCheck) {
      const mongoHealth = await mongo.healthCheck();
      checks.mongodb = mongoHealth;
      // MongoDB is optional, don't fail readiness for it
    } else {
      checks.mongodb = { status: 'not_configured' };
    }
  } catch (error) {
    checks.mongodb = { status: 'unavailable', error: error.message };
    // Not critical
  }

  // Check Redis (optional — degrades to in-memory rate limiting)
  try {
    const redisHealth = await redisHealthCheck();
    checks.redis = redisHealth;
    // Redis is optional, don't fail readiness
  } catch (error) {
    checks.redis = { status: 'unavailable', error: error.message };
  }

  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    service: 'pla-backend',
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * GET /health/live
 * Liveness check — is the process running and responsive?
 * Used by Kubernetes liveness probes
 */
router.get('/health/live', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`
    },
    uptime: `${Math.round(process.uptime())}s`,
    pid: process.pid
  });
});

/**
 * GET /health/db
 * Database status (debug)
 */
router.get('/health/db', async (req, res) => {
  try {
    const postgres = require('../config/postgres');
    const counts = {};
    for (const table of ['students', 'modules', 'skills', 'questions', 'mastery', 'reading_materials', 'classes']) {
      try {
        const result = await postgres.query(`SELECT count(*) as count FROM ${table}`);
        counts[table] = parseInt(result.rows[0].count, 10);
      } catch {
        counts[table] = 'error';
      }
    }
    try {
      const pwCheck = await postgres.query("SELECT student_id, username, role, CASE WHEN password_hash = 'PLACEHOLDER' THEN 'PLACEHOLDER' WHEN password_hash IS NULL THEN 'NULL' ELSE 'HASHED' END as pw_status FROM students");
      counts.accounts = pwCheck.rows;
    } catch (e) {
      counts.accounts_error = e.message;
    }
    res.json({ status: 'ok', tables: counts, env: { NODE_ENV: process.env.NODE_ENV, hasDbUrl: !!process.env.DATABASE_URL } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /health/db/fix-passwords
 * Manually set password hashes for demo accounts (emergency fix)
 */
router.post('/health/db/fix-passwords', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const postgres = require('../config/postgres');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');

    const accounts = [
      { id: 'STU001', pw: 'Test1234' },
      { id: 'STU002', pw: 'Test1234' },
      { id: 'STU003', pw: 'Test1234' },
      { id: 'STU004', pw: 'Test1234' },
      { id: 'STU005', pw: 'Test1234' },
      { id: 'TCH001', pw: 'Teacher1234' },
    ];

    const results = [];
    for (const { id, pw } of accounts) {
      const hash = await bcrypt.hash(pw, rounds);
      const r = await postgres.query('UPDATE students SET password_hash = $1 WHERE student_id = $2 RETURNING student_id, username', [hash, id]);
      results.push({ id, updated: r.rowCount > 0, username: r.rows[0]?.username });
    }

    res.json({ message: 'Passwords fixed', results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
