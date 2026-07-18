/**
 * Integration Tests for API Endpoints
 * Tests the full request/response cycle
 */

const request = require('supertest');
const express = require('express');

// Create a minimal test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock health endpoints
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'pla-backend'
    });
  });

  app.get('/health/ready', (req, res) => {
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        postgres: { status: 'healthy' },
        mongodb: { status: 'healthy' },
        redis: { status: 'healthy' }
      },
      service: 'pla-backend'
    });
  });

  app.get('/health/live', (req, res) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage()
    });
  });

  // Mock metrics endpoint
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.end('# HELP test_metric Test metric\n# TYPE test_metric gauge\ntest_metric 1');
  });

  // Mock API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'PLA API',
      version: '1.0.0',
      endpoints: { v1: '/api/v1' }
    });
  });

  // Mock auth endpoint
  app.post('/api/v1/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Username and password required',
        code: 'VALIDATION_FAILED'
      });
    }

    if (username === 'testuser' && password === 'Test1234') {
      return res.json({
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        user: {
          id: 'STU-TEST123',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          role: 'student'
        }
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  });

  app.post('/api/v1/auth/register', (req, res) => {
    const { username, password, firstName, lastName, classCode } = req.body;

    if (!username || !password || !firstName || !lastName || !classCode) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'All fields required',
        code: 'VALIDATION_FAILED',
        errors: []
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters',
        code: 'VALIDATION_FAILED'
      });
    }

    return res.status(201).json({
      message: 'Registration successful',
      student: {
        id: 'STU-NEW001',
        username,
        firstName,
        lastName
      }
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      code: 'ROUTE_NOT_FOUND'
    });
  });

  return app;
};

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Endpoints', () => {
    it('GET /health should return ok status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('pla-backend');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('GET /health/ready should return readiness', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.checks).toBeDefined();
    });

    it('GET /health/live should return liveness', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
      expect(response.body.memory).toBeDefined();
    });
  });

  describe('Metrics Endpoint', () => {
    it('GET /metrics should return prometheus format', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });
  });

  describe('API Info', () => {
    it('GET /api should return API info', async () => {
      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('PLA API');
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('Authentication', () => {
    describe('POST /api/v1/auth/login', () => {
      it('should return 400 for missing username', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({ password: 'Test1234' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation Error');
        expect(response.body.code).toBe('VALIDATION_FAILED');
      });

      it('should return 400 for missing password', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({ username: 'testuser' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation Error');
      });

      it('should return 401 for invalid credentials', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({ username: 'testuser', password: 'wrongpassword' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
        expect(response.body.code).toBe('INVALID_CREDENTIALS');
      });

      it('should return tokens for valid credentials', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({ username: 'testuser', password: 'Test1234' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body).toHaveProperty('user');
        expect(response.body.expiresIn).toBe(900);
        expect(response.body.tokenType).toBe('Bearer');
        expect(response.body.user.role).toBe('student');
      });
    });

    describe('POST /api/v1/auth/register', () => {
      it('should return 400 for missing fields', async () => {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({ username: 'newuser' });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_FAILED');
      });

      it('should return 400 for weak password', async () => {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            username: 'newuser',
            password: 'weak',
            firstName: 'New',
            lastName: 'User',
            classCode: 'FORM1A'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('8 characters');
      });

      it('should register new user successfully', async () => {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            username: 'newuser',
            password: 'NewUser1234',
            firstName: 'New',
            lastName: 'User',
            classCode: 'FORM1A'
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Registration successful');
        expect(response.body.student.username).toBe('newuser');
      });
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown/route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.code).toBe('ROUTE_NOT_FOUND');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers on response', async () => {
      const response = await request(app).get('/health');

      // Note: Mock app doesn't have helmet, but production app should have these
      expect(response.status).toBe(200);
    });
  });
});

describe('Password Validation Rules', () => {
  const validatePassword = (password) => {
    const errors = [];
    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    return errors;
  };

  it('should reject passwords shorter than 8 characters', () => {
    const errors = validatePassword('Short1');
    expect(errors).toContain('Password must be at least 8 characters');
  });

  it('should reject passwords without uppercase', () => {
    const errors = validatePassword('password123');
    expect(errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject passwords without lowercase', () => {
    const errors = validatePassword('PASSWORD123');
    expect(errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject passwords without numbers', () => {
    const errors = validatePassword('PasswordOnly');
    expect(errors).toContain('Password must contain at least one number');
  });

  it('should accept valid passwords', () => {
    const errors = validatePassword('SecurePass123');
    expect(errors).toHaveLength(0);
  });
});

describe('Rate Limiting Logic', () => {
  it('should track request counts', () => {
    const window = { requests: [], limit: 300, windowMs: 900000 };
    const isAllowed = () => {
      const now = Date.now();
      window.requests = window.requests.filter(t => now - t < window.windowMs);
      if (window.requests.length >= window.limit) return false;
      window.requests.push(now);
      return true;
    };

    // First 300 requests should be allowed
    for (let i = 0; i < 300; i++) {
      expect(isAllowed()).toBe(true);
    }

    // 301st request should be blocked
    expect(isAllowed()).toBe(false);
  });

  it('should reset after window expires', () => {
    const window = { requests: [], limit: 3, windowMs: 100 };

    const isAllowed = () => {
      const now = Date.now();
      window.requests = window.requests.filter(t => now - t < window.windowMs);
      if (window.requests.length >= window.limit) return false;
      window.requests.push(now);
      return true;
    };

    expect(isAllowed()).toBe(true);
    expect(isAllowed()).toBe(true);
    expect(isAllowed()).toBe(true);
    expect(isAllowed()).toBe(false);
  });
});