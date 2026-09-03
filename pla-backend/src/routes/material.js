/**
 * Material Routes
 * Reading materials endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { catchAsync, NotFoundError } = require('../middleware/errorHandler');
const queries = require('../models/sql/queries');
const redis = require('../config/redis');

/**
 * GET /materials
 * Get personalized reading materials
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { skillId, category } = req.query;

  // Get student's weak skills
  const masteryProfile = await queries.mastery.getStudentMastery(studentId);
  const weakSkills = masteryProfile
    .filter(s => s.mastery_probability < 0.7)
    .map(s => s.skill_id);

  let materials = [];

  // If specific skill requested
  if (skillId) {
    materials = await getMaterialsBySkill(skillId);
  }
  // If category requested
  else if (category) {
    materials = await getMaterialsByCategory(category);
  }
  // Return personalized materials for weak skills
  else {
    materials = await getPersonalizedMaterials(weakSkills);
  }

  res.json({
    materials,
    personalized: !skillId && !category,
    recommendations: weakSkills.slice(0, 3).map(skillId => ({
      skillId,
      reason: 'based on your practice needs'
    }))
  });
}));

/**
 * GET /materials/:id
 * Get specific material
 */
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const materialId = req.params.id;

  const material = await getMaterialById(materialId);

  if (!material) {
    throw new NotFoundError('Material');
  }

  // Track material access
  await trackMaterialAccess(req.user.id, materialId);

  res.json(material);
}));

/**
 * GET /materials/by-skill/:skillId
 * Get materials for specific skill
 */
router.get('/by-skill/:skillId', authenticate, catchAsync(async (req, res) => {
  const { skillId } = req.params;

  const materials = await getMaterialsBySkill(skillId);

  res.json({ materials });
}));

// Helper functions
async function getMaterialsBySkill(skillId) {
  try {
    // Query reading_materials table
    const result = await require('../config/postgres').query(
      `SELECT * FROM reading_materials WHERE skill_id = $1 AND deleted_at IS NULL ORDER BY difficulty_level`,
      [skillId]
    );
    return result.rows.map(formatMaterial);
  } catch {
    return [];
  }
}

async function getMaterialsByCategory(category) {
  try {
    const result = await require('../config/postgres').query(
      `SELECT * FROM reading_materials WHERE category = $1 AND deleted_at IS NULL`,
      [category]
    );
    return result.rows.map(formatMaterial);
  } catch {
    return [];
  }
}

async function getPersonalizedMaterials(weakSkillIds) {
  if (weakSkillIds.length === 0) {
    // Return general materials
    return getMaterialsByCategory('general');
  }

  const materials = [];
  for (const skillId of weakSkillIds.slice(0, 5)) {
    const skillMaterials = await getMaterialsBySkill(skillId);
    materials.push(...skillMaterials);
  }

  return materials;
}

async function getMaterialById(materialId) {
  try {
    const result = await require('../config/postgres').query(
      'SELECT * FROM reading_materials WHERE material_id = $1 AND deleted_at IS NULL',
      [materialId]
    );
    return result.rows[0] ? formatMaterial(result.rows[0]) : null;
  } catch {
    return null;
  }
}

async function trackMaterialAccess(studentId, materialId) {
  try {
    const { AuditLog } = require('../config/mongo');
    await AuditLog.create({
      event: 'MATERIAL_ACCESS',
      userId: studentId,
      resource: 'reading_materials',
      action: 'read',
      details: { materialId },
      timestamp: new Date()
    });
  } catch {
    // Silently fail
  }
}

function formatMaterial(material) {
  return {
    id: material.material_id,
    title: material.title,
    content: material.content,
    skillId: material.skill_id,
    skillName: material.skill_name,
    category: material.category,
    difficulty: material.difficulty_level,
    estimatedReadTime: material.estimated_read_time,
    tags: material.tags ? material.tags.split(',') : []
  };
}

module.exports = router;