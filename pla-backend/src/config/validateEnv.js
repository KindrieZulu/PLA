/**
 * Environment Validation
 * Validates all required environment variables at startup
 * Prevents the application from running with missing critical configuration
 */

const requiredVars = [
  'JWT_SECRET',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'SESSION_SECRET'
];

const optionalVars = [
  'SENTRY_DSN',
  'ELASTICSEARCH_NODE',
  'REDIS_HOST',
  'REDIS_PORT',
  'MONGO_URI'
];

// Validate JWT_SECRET length
const validateJwtSecret = (secret) => {
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return true;
};

// Validate PORT
const validatePort = (port) => {
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }
  return true;
};

// Validate MongoDB URI format
const validateMongoUri = (uri) => {
  if (!uri.startsWith('mongodb')) {
    throw new Error('MONGO_URI must be a valid MongoDB connection string');
  }
  return true;
};

// Main validation function
const validateEnv = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in the values.'
    );
  }

  // Validate specific values
  try {
    validateJwtSecret(process.env.JWT_SECRET);
    if (process.env.PORT) {
      validatePort(process.env.PORT);
    }
    if (process.env.MONGO_URI) {
      validateMongoUri(process.env.MONGO_URI);
    }
  } catch (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  // Check optional variables and warn if missing
  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Security warnings
  if (process.env.NODE_ENV === 'production') {
    if (process.env.CORS_ORIGIN?.includes('localhost')) {
      console.warn('⚠️  WARNING: CORS_ORIGIN contains localhost in production!');
    }
    if (!process.env.SENTRY_DSN) {
      console.warn('⚠️  WARNING: SENTRY_DSN not set - error tracking disabled in production');
    }
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.log(`ℹ️  Optional environment variables not set: ${warnings.join(', ')}`);
  }

  console.log('✅ Environment validation passed');
  return true;
};

module.exports = { validateEnv };