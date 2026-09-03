/**
 * Teacher Routes
 * Teacher-specific endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireTeacher } = require('../middleware/roleMiddleware');
const { teacherQueryValidation } = require('../middleware/validators/authValidators');
const { catchAsync, ForbiddenError } = require('../middleware/errorHandler');
const queries = require('../models/sql/queries');

/**
 * GET /teacher/students
 * List teacher's students
 */
router.get('/students', authenticate, requireTeacher, teacherQueryValidation, catchAsync(async (req, res) => {
  const teacherId = req.user.id;
  const { page = 1, limit = 50, classId } = req.query;
  const offset = (page - 1) * limit;

  let students;

  if (classId) {
    // Filter by class
    const classData = await queries.classes.getById(classId);
    if (!classData || classData.teacher_id !== teacherId) {
      throw new ForbiddenError('Access denied to this class');
    }
    students = await queries.students.getByClass(classId, parseInt(limit, 10), offset);
  } else {
    // Get all teacher's students
    students = await queries.students.getByTeacher(teacherId, parseInt(limit, 10), offset);
  }

  // Enrich with mastery data
  const enrichedStudents = await Promise.all(students.map(async (student) => {
    const stats = await queries.mastery.getMasteryStats(student.student_id);
    return {
      id: student.student_id,
      firstName: student.first_name,
      lastName: student.last_name,
      username: student.username,
      gradeLevel: student.grade_level,
      classId: student.class_id,
      avatarUrl: student.avatar_url,
      mastery: {
        avg: stats?.avg_mastery ? (stats.avg_mastery * 100).toFixed(1) : 0,
        mastered: parseInt(stats?.mastered || 0, 10),
        inProgress: parseInt(stats?.in_progress || 0, 10),
        needsSupport: parseInt(stats?.needs_support || 0, 10)
      },
      createdAt: student.created_at
    };
  }));

  res.json({
    students: enrichedStudents,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    }
  });
}));

/**
 * GET /teacher/students/:id/summary
 * Get student summary for teacher
 */
router.get('/students/:id/summary', authenticate, requireTeacher, catchAsync(async (req, res) => {
  const studentId = req.params.id;

  const summary = await queries.teachers.getStudentSummary(studentId);

  if (!summary) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Student not found'
    });
  }

  // Get detailed mastery
  const masteryProfile = await queries.mastery.getStudentMastery(studentId);
  const recentSessions = await queries.sessions.getStudentSessions(studentId, 10);

  res.json({
    student: {
      id: summary.student_id,
      firstName: summary.first_name,
      lastName: summary.last_name,
      username: summary.username,
      gradeLevel: summary.grade_level,
      avatarUrl: summary.avatar_url
    },
    progress: {
      overallMastery: summary.overall_mastery ? (summary.overall_mastery * 100).toFixed(1) : 0,
      skillsMastered: summary.skills_mastered,
      totalSessions: summary.total_sessions
    },
    masteryProfile: masteryProfile.map(m => ({
      skillId: m.skill_id,
      skillName: m.skill_name,
      mastery: (m.mastery_probability * 100).toFixed(1),
      theta: m.theta_estimate ? m.theta_estimate.toFixed(2) : 0,
      lastPracticed: m.last_practiced
    })),
    recentSessions: recentSessions.map(s => ({
      date: s.started_at,
      duration: s.duration,
      questionsAnswered: s.questions_answered,
      accuracy: s.questions_answered > 0
        ? ((s.correct_answers / s.questions_answered) * 100).toFixed(1)
        : 0
    }))
  });
}));

/**
 * GET /teacher/class-overview
 * Get overview of teacher's classes
 */
router.get('/class-overview', authenticate, requireTeacher, catchAsync(async (req, res) => {
  const teacherId = req.user.id;

  const classes = await queries.classes.getByTeacher(teacherId);

  const classOverviews = await Promise.all(classes.map(async (classItem) => {
    const overview = await queries.teachers.getClassOverview(classItem.class_id);
    return {
      classId: classItem.class_id,
      className: classItem.class_name,
      subject: classItem.subject,
      studentCount: parseInt(overview?.student_count || 0, 10),
      avgMastery: overview?.avg_mastery ? (overview.avg_mastery * 100).toFixed(1) : 0,
      skillsCovered: parseInt(overview?.skills_covered || 0, 10)
    };
  }));

  res.json({ classes: classOverviews });
}));

/**
 * GET /teacher/class/:id/students
 * Get students in a specific class
 */
router.get('/class/:id/students', authenticate, requireTeacher, catchAsync(async (req, res) => {
  const classId = req.params.id;
  const teacherId = req.user.id;

  const classData = await queries.classes.getById(classId);
  if (!classData || classData.teacher_id !== teacherId) {
    throw new ForbiddenError('Access denied to this class');
  }

  const students = await queries.students.getByClass(classId, 100, 0);

  // Enrich with mastery
  const enriched = await Promise.all(students.map(async (student) => {
    const stats = await queries.mastery.getMasteryStats(student.student_id);
    return {
      id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      mastery: stats?.avg_mastery ? (stats.avg_mastery * 100).toFixed(1) : 0,
      lastActive: await getLastActive(student.student_id)
    };
  }));

  res.json({
    class: {
      id: classData.class_id,
      name: classData.class_name,
      studentCount: students.length
    },
    students: enriched
  });
}));

async function getLastActive(studentId) {
  const sessions = await queries.sessions.getStudentSessions(studentId, 1);
  return sessions.length > 0 ? sessions[0].started_at : null;
}

module.exports = router;