/**
 * SQL Queries — adapted for the ZIMSEC pla_db.sql schema
 * Uses VARCHAR IDs, original column names from pla_db.sql
 */

const { query, transaction } = require('../../config/postgres');
const logger = require('../../config/logger');

// ==========================================
// STUDENT QUERIES
// ==========================================

const studentQueries = {
  findById: async (studentId) => {
    const result = await query(
      'SELECT student_id, first_name, last_name, username, grade_level, role, created_at FROM students WHERE student_id = $1',
      [studentId]
    );
    return result.rows[0];
  },

  findByUsername: async (username) => {
    const result = await query(
      'SELECT * FROM students WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    return result.rows[0];
  },

  findByUsernameWithPassword: async (username) => {
    const result = await query(
      'SELECT * FROM students WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    return result.rows[0];
  },

  create: async (data) => {
    const { studentId, firstName, lastName, username, passwordHash, gradeLevel, classId, age, gender, schoolId } = data;
    const result = await query(
      `INSERT INTO students (student_id, first_name, last_name, username, password_hash, grade_level, class_id, age, gender, school_id, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'student')
       RETURNING student_id, first_name, last_name, username, grade_level, role, created_at`,
      [studentId, firstName, lastName, username.toLowerCase(), passwordHash, gradeLevel, classId, age, gender, schoolId]
    );
    return result.rows[0];
  },

  getByClass: async (classId, limit = 50, offset = 0) => {
    const result = await query(
      'SELECT student_id, first_name, last_name, username, grade_level, created_at FROM students WHERE class_id = $1 ORDER BY last_name LIMIT $2 OFFSET $3',
      [classId, limit, offset]
    );
    return result.rows;
  },

  getAll: async (limit = 100) => {
    const result = await query(
      'SELECT student_id, first_name, last_name, username, grade_level, role, created_at FROM students ORDER BY role, last_name LIMIT $1',
      [limit]
    );
    return result.rows;
  },

  getByTeacher: async (teacherId, limit = 100, offset = 0) => {
    const result = await query(
      `SELECT s.student_id, s.first_name, s.last_name, s.username, s.grade_level, s.class_id, s.created_at
       FROM students s
       JOIN classes c ON s.class_id = c.class_id
       WHERE c.teacher_id = $1 AND s.role = 'student'
       ORDER BY s.last_name LIMIT $2 OFFSET $3`,
      [teacherId, limit, offset]
    );
    return result.rows;
  }
};

// ==========================================
// AUTH QUERIES
// ==========================================

const authQueries = {
  storeRefreshToken: async (token, userId, expiresAt) => {
    const hash = require('crypto').createHash('sha256').update(token).digest('hex');
    const tokenId = require('uuid').v4();
    await query(
      'INSERT INTO refresh_tokens (token_id, token_hash, user_id, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenId, hash, userId, expiresAt]
    );
  },

  getRefreshToken: async (token) => {
    const hash = require('crypto').createHash('sha256').update(token).digest('hex');
    const result = await query(
      `SELECT rt.*, s.username, s.role FROM refresh_tokens rt
       JOIN students s ON rt.user_id = s.student_id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [hash]
    );
    return result.rows[0];
  },

  revokeRefreshToken: async (token) => {
    const hash = require('crypto').createHash('sha256').update(token).digest('hex');
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [hash]);
  },

  revokeAllUserTokens: async (userId) => {
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  }
};

// ==========================================
// MASTERY QUERIES
// ==========================================

const masteryQueries = {
  getStudentMastery: async (studentId) => {
    const result = await query(
      `SELECT m.*, s.skill_name, s.module_id, s.sequence_order, s.bkt_prior, s.bkt_learn, s.bkt_slip, s.bkt_guess
       FROM mastery m
       JOIN skills s ON m.skill_id = s.skill_id
       WHERE m.student_id = $1
       ORDER BY s.sequence_order`,
      [studentId]
    );
    return result.rows;
  },

  getSkillMastery: async (studentId, skillId) => {
    const result = await query(
      'SELECT * FROM mastery WHERE student_id = $1 AND skill_id = $2',
      [studentId, skillId]
    );
    return result.rows[0];
  },

  upsertMastery: async (studentId, skillId, masteryData) => {
    const { masteryProbability, masteryStatus } = masteryData;
    const result = await query(
      `INSERT INTO mastery (student_id, skill_id, mastery_probability, mastery_status, last_updated)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (student_id, skill_id) DO UPDATE SET
         mastery_probability = $3, mastery_status = $4, last_updated = NOW()
       RETURNING *`,
      [studentId, skillId, masteryProbability, masteryStatus || 'in_progress']
    );
    return result.rows[0];
  },

  getMasteryStats: async (studentId) => {
    const result = await query(
      `SELECT
         COUNT(*) as total_skills,
         COUNT(CASE WHEN mastery_probability >= 0.75 THEN 1 END) as mastered,
         COUNT(CASE WHEN mastery_probability >= 0.4 AND mastery_probability < 0.75 THEN 1 END) as in_progress,
         COUNT(CASE WHEN mastery_probability < 0.4 THEN 1 END) as needs_support,
         AVG(mastery_probability) as avg_mastery
       FROM mastery WHERE student_id = $1`,
      [studentId]
    );
    return result.rows[0];
  }
};

// ==========================================
// QUESTION QUERIES
// ==========================================

const questionQueries = {
  getBySkill: async (skillId, limit = 20) => {
    const result = await query(
      `SELECT q.*, s.skill_name FROM questions q
       JOIN skills s ON q.skill_id = s.skill_id
       WHERE q.skill_id = $1
       ORDER BY RANDOM() LIMIT $2`,
      [skillId, limit]
    );
    return result.rows;
  },

  getById: async (questionId) => {
    const result = await query(
      `SELECT q.*, s.skill_name, s.skill_id FROM questions q
       JOIN skills s ON q.skill_id = s.skill_id
       WHERE q.question_id = $1`,
      [questionId]
    );
    return result.rows[0];
  },

  getDiagnosticQuestions: async (moduleId, count = 10) => {
    const result = await query(
      `SELECT q.*, s.skill_name FROM questions q
       JOIN skills s ON q.skill_id = s.skill_id
       WHERE s.module_id = $1 AND q.question_type = 'diagnostic'
       ORDER BY RANDOM() LIMIT $2`,
      [moduleId, count]
    );
    return result.rows;
  },

  getAdaptive: async (studentId, limit = 5) => {
    // Get questions for skills where mastery is lowest
    const result = await query(
      `SELECT q.*, s.skill_name
       FROM questions q
       JOIN skills s ON q.skill_id = s.skill_id
       LEFT JOIN mastery m ON m.skill_id = s.skill_id AND m.student_id = $1
       WHERE m.mastery_probability IS NULL OR m.mastery_probability < 0.75
       ORDER BY COALESCE(m.mastery_probability, 0) ASC, RANDOM()
       LIMIT $2`,
      [studentId, limit]
    );
    return result.rows;
  }
};

// ==========================================
// SESSION QUERIES
// ==========================================

const sessionQueries = {
  create: async (sessionId, studentId, classId) => {
    const result = await query(
      'INSERT INTO sessions (session_id, student_id, class_id) VALUES ($1, $2, $3) RETURNING *',
      [sessionId, studentId, classId]
    );
    return result.rows[0];
  },

  end: async (sessionId, stats) => {
    const result = await query(
      `UPDATE sessions SET ended_at = NOW(), status = 'completed', duration = $2,
       questions_answered = $3, correct_answers = $4 WHERE session_id = $1 RETURNING *`,
      [sessionId, stats.duration, stats.questionsAnswered, stats.correctAnswers]
    );
    return result.rows[0];
  },

  getStudentSessions: async (studentId, limit = 20) => {
    const result = await query(
      'SELECT * FROM sessions WHERE student_id = $1 ORDER BY started_at DESC LIMIT $2',
      [studentId, limit]
    );
    return result.rows;
  }
};

// ==========================================
// CLASS QUERIES
// ==========================================

const classQueries = {
  findByCode: async (classCode) => {
    const result = await query(
      'SELECT * FROM classes WHERE class_code = $1',
      [classCode.toUpperCase()]
    );
    return result.rows[0];
  },

  getById: async (classId) => {
    const result = await query('SELECT * FROM classes WHERE class_id = $1', [classId]);
    return result.rows[0];
  },

  getByTeacher: async (teacherId) => {
    const result = await query(
      'SELECT * FROM classes WHERE teacher_id = $1 ORDER BY class_name',
      [teacherId]
    );
    return result.rows;
  }
};

// ==========================================
// TEACHER QUERIES
// ==========================================

const teacherQueries = {
  getClassOverview: async (classId) => {
    const result = await query(
      `SELECT c.class_id, c.class_name, c.class_code,
         COUNT(DISTINCT s.student_id) as student_count,
         AVG(m.mastery_probability) as avg_mastery
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.class_id
       LEFT JOIN mastery m ON m.student_id = s.student_id
       WHERE c.class_id = $1
       GROUP BY c.class_id, c.class_name, c.class_code`,
      [classId]
    );
    return result.rows[0];
  },

  getStudentSummary: async (studentId) => {
    const result = await query(
      `SELECT s.student_id, s.first_name, s.last_name, s.username, s.grade_level,
         COUNT(DISTINCT m.skill_id) as skills_mastered,
         AVG(m.mastery_probability) as overall_mastery
       FROM students s
       LEFT JOIN mastery m ON m.student_id = s.student_id AND m.mastery_probability >= 0.75
       WHERE s.student_id = $1
       GROUP BY s.student_id, s.first_name, s.last_name, s.username, s.grade_level`,
      [studentId]
    );
    return result.rows[0];
  }
};

// ==========================================
// CURRICULUM QUERIES
// ==========================================

const curriculumQueries = {
  getModules: async (gradeLevel = 'Form 1') => {
    const result = await query(
      'SELECT * FROM modules WHERE grade_level = $1 ORDER BY sequence_order',
      [gradeLevel]
    );
    return result.rows;
  },

  getSkillsByModule: async (moduleId) => {
    const result = await query(
      'SELECT * FROM skills WHERE module_id = $1 ORDER BY sequence_order',
      [moduleId]
    );
    return result.rows;
  }
};

// ==========================================
// MATERIALS QUERIES
// ==========================================

const materialQueries = {
  getBySkill: async (skillId) => {
    const result = await query(
      'SELECT * FROM reading_materials WHERE skill_id = $1 ORDER BY content_type',
      [skillId]
    );
    return result.rows;
  },

  getAll: async (limit = 50) => {
    const result = await query(
      'SELECT * FROM reading_materials ORDER BY skill_id, content_type LIMIT $1',
      [limit]
    );
    return result.rows;
  }
};

module.exports = {
  students: studentQueries,
  auth: authQueries,
  mastery: masteryQueries,
  questions: questionQueries,
  sessions: sessionQueries,
  classes: classQueries,
  teachers: teacherQueries,
  curriculum: curriculumQueries,
  materials: materialQueries,
  transaction
};
