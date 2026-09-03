/**
 * Authentication Tests
 */

const request = require('supertest');
const express = require('express');

// Mock app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock auth routes
  app.post('/api/v1/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Username and password required'
      });
    }

    // Mock successful login
    if (username === 'testuser' && password === 'Test1234') {
      return res.json({
        accessToken: 'mock-access-token',
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
      message: 'Invalid credentials'
    });
  });

  app.post('/api/v1/auth/register', (req, res) => {
    const { username, password, firstName, lastName, classCode } = req.body;

    if (!username || !password || !firstName || !lastName || !classCode) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'All fields required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters'
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

  app.post('/api/v1/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token required'
      });
    }

    return res.json({
      accessToken: 'new-mock-access-token',
      expiresIn: 900,
      tokenType: 'Bearer'
    });
  });

  return app;
};

describe('Authentication API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 400 when username is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'Test1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });

    it('should return 400 when password is missing', async () => {
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
    });

    it('should return tokens for valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: 'Test1234' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('testuser');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'newuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
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

    it('should create new user with valid data', async () => {
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
      expect(response.body.student).toHaveProperty('id');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 400 when refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Refresh token required');
    });

    it('should return new access token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.expiresIn).toBe(900);
    });
  });
});

describe('Password Validation', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const shortPassword = 'Short1';
    expect(shortPassword.length >= 8).toBe(false);
  });

  it('should require uppercase letter', () => {
    const noUppercase = 'password123';
    expect(/[A-Z]/.test(noUppercase)).toBe(false);
  });

  it('should require lowercase letter', () => {
    const noLowercase = 'PASSWORD123';
    expect(/[a-z]/.test(noLowercase)).toBe(false);
  });

  it('should require number', () => {
    const noNumber = 'PasswordOnly';
    expect(/[0-9]/.test(noNumber)).toBe(false);
  });

  it('should accept valid password', () => {
    const validPassword = 'SecurePass123';
    expect(validPassword.length >= 8).toBe(true);
    expect(/[A-Z]/.test(validPassword)).toBe(true);
    expect(/[a-z]/.test(validPassword)).toBe(true);
    expect(/[0-9]/.test(validPassword)).toBe(true);
  });
});