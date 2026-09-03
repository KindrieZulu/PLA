/**
 * Input Validators
 * express-validator chains for request validation and sanitization
 */

const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      code: 'VALIDATION_FAILED',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Auth validators
const loginValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters'),
  validate
];

const registerValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ max: 100 }).withMessage('First name too long'),
  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ max: 100 }).withMessage('Last name too long'),
  body('classCode')
    .trim()
    .notEmpty().withMessage('Class code is required')
    .isLength({ max: 20 }).withMessage('Invalid class code'),
  validate
];

const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token required')
    .isLength({ min: 64, max: 128 }).withMessage('Invalid refresh token format'),
  validate
];

// Session validators
const sessionValidation = [
  body('classId')
    .optional()
    .isLength({ max: 20 }).withMessage('Invalid class ID'),
  validate
];

// Attempt validators
const attemptValidation = [
  body('sessionId')
    .notEmpty().withMessage('Session ID required')
    .isLength({ max: 40 }).withMessage('Invalid session ID'),
  body('questionId')
    .notEmpty().withMessage('Question ID required')
    .isLength({ max: 20 }).withMessage('Invalid question ID'),
  body('answer')
    .notEmpty().withMessage('Answer required')
    .isLength({ max: 500 }).withMessage('Answer too long'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0, max: 3600 }).withMessage('Invalid time spent'),
  body('hintUsed')
    .optional()
    .isInt({ min: 0, max: 10 }).withMessage('Invalid hint count'),
  body('difficultyLevel')
    .optional()
    .isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty level'),
  validate
];

const bulkAttemptValidation = [
  body('attempts')
    .isArray({ min: 1, max: 100 }).withMessage('Attempts must be an array of 1-100 items'),
  body('attempts.*.sessionId')
    .notEmpty().withMessage('Session ID required for each attempt'),
  body('attempts.*.questionId')
    .notEmpty().withMessage('Question ID required for each attempt'),
  body('attempts.*.answer')
    .notEmpty().withMessage('Answer required for each attempt'),
  body('attempts.*.timestamp')
    .isISO8601().withMessage('Invalid timestamp format'),
  validate
];

// Diagnostic validators
const diagnosticSubmitValidation = [
  body('answers')
    .isArray({ min: 1, max: 50 }).withMessage('Answers must be an array'),
  body('answers.*.questionId')
    .notEmpty().withMessage('Question ID required'),
  body('answers.*.answer')
    .notEmpty().withMessage('Answer required'),
  body('answers.*.timeSpent')
    .optional()
    .isInt({ min: 0, max: 3600 }),
  validate
];

// Teacher validators
const teacherQueryValidation = [
  query('classId')
    .optional()
    .isLength({ max: 20 }).withMessage('Invalid class ID'),
  query('studentId')
    .optional()
    .isLength({ max: 20 }).withMessage('Invalid student ID'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Invalid page number'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
  validate
];

// ID param validators
const mongoIdValidation = [
  param('id')
    .isLength({ min: 24, max: 36 }).withMessage('Invalid ID format'),
  validate
];

// Pagination validation
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('sort')
    .optional()
    .isIn(['created_at', 'updated_at', 'username', 'mastery']).withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Invalid order'),
  validate
];

module.exports = {
  validate,
  loginValidation,
  registerValidation,
  refreshTokenValidation,
  sessionValidation,
  attemptValidation,
  bulkAttemptValidation,
  diagnosticSubmitValidation,
  teacherQueryValidation,
  mongoIdValidation,
  paginationValidation
};