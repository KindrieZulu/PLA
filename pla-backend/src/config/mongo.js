/**
 * MongoDB Configuration
 * Mongoose connection with automatic reconnection and monitoring
 */

const mongoose = require('mongoose');
const logger = require('./logger');

// Build connection string with auth if credentials provided
const buildConnectionString = () => {
  let uri = process.env.MONGO_URI;

  // If user and password provided separately, build authenticated URI
  if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
    const url = new URL(uri);
    url.username = process.env.MONGO_USER;
    url.password = process.env.MONGO_PASSWORD;
    uri = url.toString();
  }

  return uri;
};

// Connection options
const connectionOptions = {
  maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE || '10', 10),
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL || '2', 10),
  serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT || '5000', 10),
  socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT || '45000', 10),
  family: 4, // Use IPv4
  directConnection: process.env.MONGO_DIRECT_CONNECTION === 'true',
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  wtimeoutMS: 2500
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected', {
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  });
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', {
    error: err.message,
    stack: err.stack
  });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected', {
    wasHost: mongoose.connection.host
  });
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected', {
    host: mongoose.connection.host
  });
});

// Connection string
const MONGO_URI = buildConnectionString();

// Connect function — skips if MONGO_URI is not set
const connect = async (retries = 5, delay = 5000) => {
  if (!MONGO_URI || MONGO_URI === '' || MONGO_URI === 'undefined') {
    logger.warn('MONGO_URI not configured — skipping MongoDB connection');
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`MongoDB connection attempt ${attempt}/${retries}...`);

      await mongoose.connect(MONGO_URI, connectionOptions);

      logger.info('MongoDB connected successfully');
      return;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt} failed`, {
        error: error.message
      });

      if (attempt === retries) {
        logger.error('All MongoDB connection attempts exhausted');
        throw error;
      }

      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Health check function
const healthCheck = async () => {
  try {
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.ping();

    return {
      status: 'healthy',
      version: mongoose.version,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Graceful shutdown
const shutdown = async (force = false) => {
  logger.info('Shutting down MongoDB connection...');

  try {
    if (force) {
      await mongoose.connection.close(false);
    } else {
      await mongoose.connection.close(true);
    }
    logger.info('MongoDB connection closed successfully');
  } catch (error) {
    logger.error('Error closing MongoDB connection', { error: error.message });
    throw error;
  }
};

// Mongoose schemas and models
const Schema = mongoose.Schema;

// Session Schema - tracks learning sessions
const SessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  classId: { type: String, index: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  duration: { type: Number }, // in seconds
  questionsAnswered: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  skillsPracticed: [{ type: String }],
  difficultyDistribution: {
    easy: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    hard: { type: Number, default: 0 }
  },
  offline: { type: Boolean, default: false },
  syncedAt: { type: Date },
  device: { type: String },
  platform: { type: String } // 'web', 'mobile', 'tablet'
}, {
  timestamps: true,
  collection: 'sessions'
});

SessionSchema.index({ studentId: 1, startedAt: -1 });
SessionSchema.index({ classId: 1, startedAt: -1 });

// Attempt Schema - individual question attempts
const AttemptSchema = new Schema({
  attemptId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, required: true, index: true },
  studentId: { type: String, required: true, index: true },
  questionId: { type: String, required: true },
  skillId: { type: String, required: true },
  answer: { type: String },
  correct: { type: Boolean },
  isCorrect: { type: Boolean }, // Alias for correct
  hintUsed: { type: Number, default: 0 },
  hintsUsed: [{ type: Number }],
  timeSpent: { type: Number }, // in seconds
  timestamp: { type: Date, default: Date.now },
  offline: { type: Boolean, default: false },
  syncedAt: { type: Date },
  clientTimestamp: { type: Date }, // Original timestamp from offline
  difficultyLevel: { type: String },
  tryCount: { type: Number, default: 1 }
}, {
  timestamps: true,
  collection: 'attempts'
});

AttemptSchema.index({ studentId: 1, timestamp: -1 });
AttemptSchema.index({ sessionId: 1, timestamp: -1 });

// FeedbackLog Schema - student feedback on questions
const FeedbackLogSchema = new Schema({
  feedbackId: { type: String, required: true, unique: true },
  studentId: { type: String, required: true, index: true },
  questionId: { type: String, required: true },
  attemptId: { type: String },
  helpful: { type: Boolean },
  difficulty: { type: String, enum: ['too_easy', 'just_right', 'too_hard'] },
  comment: { type: String },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'feedback_logs'
});

// AuditLog Schema - system audit trail
const AuditLogSchema = new Schema({
  event: { type: String, required: true, index: true },
  userId: { type: String, index: true },
  username: { type: String },
  role: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  resource: { type: String },
  action: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true },
  duration: { type: Number },
  statusCode: { type: Number }
}, {
  timestamps: true,
  collection: 'audit_logs'
});

AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ event: 1, timestamp: -1 });

// Virtual TA Chat Log Schema
const ChatLogSchema = new Schema({
  chatId: { type: String, required: true, unique: true },
  studentId: { type: String, required: true, index: true },
  sessionId: { type: String },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: { type: String },
    timestamp: { type: Date, default: Date.now },
    intent: { type: String },
    skillId: { type: String }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  resolved: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: 'chat_logs'
});

// Register models
const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);
const Attempt = mongoose.models.Attempt || mongoose.model('Attempt', AttemptSchema);
const FeedbackLog = mongoose.models.FeedbackLog || mongoose.model('FeedbackLog', FeedbackLogSchema);
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
const ChatLog = mongoose.models.ChatLog || mongoose.model('ChatLog', ChatLogSchema);

module.exports = {
  connect,
  healthCheck,
  shutdown,
  connection: mongoose.connection,
  Session,
  Attempt,
  FeedbackLog,
  AuditLog,
  ChatLog
};

module.exports.default = module.exports;