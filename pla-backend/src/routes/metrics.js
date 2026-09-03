/**
 * Metrics Routes
 * Prometheus metrics endpoint
 */

const express = require('express');
const router = express.Router();
const { getMetrics } = require('../config/metrics');

/**
 * GET /metrics
 * Prometheus metrics endpoint (no auth required)
 */
router.get('/', getMetrics);

module.exports = router;