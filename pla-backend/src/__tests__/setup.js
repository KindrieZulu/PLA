/**
 * Test Setup
 * Jest configuration for integration tests
 */

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long';
process.env.JWT_EXPIRES_IN = '15m';
process.env.NODE_ENV = 'test';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_USER = 'test';
process.env.POSTGRES_PASSWORD = 'test';
process.env.POSTGRES_DB = 'test_db';
process.env.MONGO_URI = 'mongodb://localhost:27017/test_db';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock external dependencies
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
  security: {
    login: jest.fn(),
    logout: jest.fn(),
    tokenRefresh: jest.fn(),
    rateLimitExceeded: jest.fn(),
    invalidToken: jest.fn(),
    failedAttempt: jest.fn(),
    accountLocked: jest.fn(),
    sensitiveOperation: jest.fn()
  }
}));

// Mock Redis
jest.mock('../config/redis', () => {
  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    delByPattern: jest.fn().mockResolvedValue(0)
  };

  return {
    redis: {
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
      on: jest.fn(),
      quit: jest.fn()
    },
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
    shutdown: jest.fn(),
    cache: mockCache,
    rateLimiter: {
      check: jest.fn().mockResolvedValue({ allowed: true, remaining: 100 })
    },
    sessionStore: mockCache,
    userSessions: {
      add: jest.fn(),
      remove: jest.fn(),
      removeAll: jest.fn()
    },
    lockout: {
      isLocked: jest.fn().mockResolvedValue(false),
      lock: jest.fn(),
      unlock: jest.fn()
    }
  };
});

// Mock PostgreSQL
jest.mock('../config/postgres', () => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  transaction: jest.fn(async (callback) => callback({ query: jest.fn() })),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  shutdown: jest.fn(),
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  }
}));

// Mock MongoDB
jest.mock('../config/mongo', () => {
  const mockModel = {
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([])
    })
  };

  return {
    connect: jest.fn().mockResolvedValue(),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
    shutdown: jest.fn(),
    Session: mockModel,
    Attempt: mockModel,
    FeedbackLog: mockModel,
    AuditLog: mockModel,
    ChatLog: mockModel,
    connection: { readyState: 1 }
  };
});

// Mock metrics
jest.mock('../config/metrics', () => ({
  register: { contentType: 'text/plain' },
  metricsMiddleware: (req, res, next) => next(),
  getMetrics: (req, res) => res.end('metrics'),
  httpRequestsTotal: { inc: jest.fn() },
  httpRequestDuration: { observe: jest.fn() },
  authAttemptsTotal: { inc: jest.fn() },
  rateLimitHitsTotal: { inc: jest.fn() },
  dbQueryDuration: { observe: jest.fn() },
  quizAttemptsTotal: { inc: jest.fn() },
  errorsTotal: { inc: jest.fn() },
  activeSessionsGauge: { inc: jest.fn(), dec: jest.fn() }
}));

// Global test utilities
global.testUtils = {
  generateToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        id: 'test-user-id',
        username: 'testuser',
        role: 'student',
        ...payload
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  generateMockStudent: (overrides = {}) => ({
    student_id: 'STU-TEST123',
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    role: 'student',
    grade_level: 'Form 1',
    ...overrides
  }),
  generateMockQuestion: (overrides = {}) => ({
    question_id: 'Q-TEST001',
    skill_id: 'SK-TEST001',
    skill_name: 'Test Skill',
    question_text: 'What is 2 + 2?',
    difficulty_level: 'Medium',
    correct_option: '4',
    ...overrides
  })
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Increase timeout for async operations
jest.setTimeout(10000);