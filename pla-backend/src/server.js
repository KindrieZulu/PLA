/**
 * Server Bootstrap
 * Main entry point that initializes database connections and starts the HTTP server
 */

require('dotenv').config();
const http = require('http');
const socketIO = require('socket.io');

const app = require('./app');
const logger = require('./config/logger');
const { validateEnv } = require('./config/validateEnv');
const postgres = require('./config/postgres');
const mongo = require('./config/mongo');
const redis = require('./config/redis');
const { healthCheck: redisHealthCheck, shutdown: redisShutdown } = require('./config/redis');
const { register } = require('./config/metrics');
const Sentry = require('@sentry/node');

// Initialize Sentry if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version || '1.0.0',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    serverName: 'pla-backend',
    attachStacktrace: true,
    beforeSend(event) {
      // Filter out health check errors
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    }
  });

  // Sentry request handler
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Server configuration
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO instance with security options
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6 // 1MB
});

// Socket.IO authentication and connection handling
const activeConnections = new Map();

io.use((socket, next) => {
  // Extract token from handshake query or auth header
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.role = decoded.role;
      next();
    } catch (error) {
      logger.security.invalidToken(socket.handshake.address, error.message);
      next(new Error('Authentication error'));
    }
  } else {
    next(new Error('No token provided'));
  }
});

io.on('connection', (socket) => {
  logger.info('Socket.IO client connected', {
    socketId: socket.id,
    userId: socket.userId,
    username: socket.username
  });

  activeConnections.set(socket.userId, socket.id);

  // Join user's personal room
  socket.join(`user:${socket.userId}`);

  // Join class room if teacher
  socket.on('join:class', (classId) => {
    socket.join(`class:${classId}`);
    logger.debug('User joined class room', { userId: socket.userId, classId });
  });

  // Real-time mastery update broadcast
  socket.on('mastery:update', (data) => {
    // Broadcast to relevant users (student and their teacher)
    io.to(`user:${data.studentId}`).emit('mastery:updated', data);
    logger.debug('Mastery update emitted', data);
  });

  // Session activity heartbeat
  socket.on('session:heartbeat', (sessionData) => {
    socket.join(`session:${sessionData.sessionId}`);
    // Notify teacher's dashboard
    socket.to(`class:${sessionData.classId}`).emit('session:activity', sessionData);
  });

  // Disconnect handling
  socket.on('disconnect', (reason) => {
    logger.info('Socket.IO client disconnected', {
      socketId: socket.id,
      userId: socket.userId,
      reason
    });
    activeConnections.delete(socket.userId);
  });

  // Error handling
  socket.on('error', (error) => {
    logger.error('Socket.IO error', {
      socketId: socket.id,
      userId: socket.userId,
      error: error.message
    });
  });
});

// Make io accessible to routes
app.set('io', io);
app.set('activeConnections', activeConnections);

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Shutdown database connections
      await Promise.all([
        postgres.shutdown(),
        mongo.shutdown(),
        redisShutdown()
      ]);

      logger.info('All connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }

  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack
  });

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
});

// Database connection and server startup
const startServer = async () => {
  try {
    // Validate environment
    if (process.env.NODE_ENV !== 'test') {
      validateEnv();
    }

    // Connect to databases (make optional for demo mode)
    logger.info('Initializing database connections...');

    // Try MongoDB connection with timeout
    try {
      await Promise.race([
        mongo.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('MongoDB timeout')), 5000))
      ]);
      logger.info('MongoDB connected successfully');
    } catch (err) {
      logger.warn('MongoDB connection failed - running in limited mode', { error: err.message });
    }

    // Try Redis connection with timeout
    try {
      await Promise.race([
        redis.redis.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000))
      ]);
      logger.info('Redis connected successfully');
    } catch (err) {
      logger.warn('Redis connection failed - running in limited mode', { error: err.message });
      // Set redis status to indicate unavailability
      redis.redis.status = 'disconnected';
    }

    logger.info('Starting server in demo/limited mode');

    // Auto-run database migration on startup
    if (process.env.NODE_ENV === 'production' || process.env.AUTO_MIGRATE === 'true') {
      try {
        const { runMigration } = require('../scripts/auto-migrate');
        await runMigration();
        logger.info('Auto-migration completed');

        // Verify migration worked
        try {
          const verifyResult = await postgres.query("SELECT student_id, password_hash FROM students LIMIT 3");
          logger.info('[VERIFY] Students after migration:', {
            count: verifyResult.rows.length,
            sample: verifyResult.rows.map(r => ({
              id: r.student_id,
              hashPrefix: r.password_hash ? r.password_hash.substring(0, 10) : 'NULL'
            }))
          });
        } catch (verifyErr) {
          logger.error('[VERIFY] Could not verify students:', { error: verifyErr.message });
        }
      } catch (migErr) {
        logger.warn('Auto-migration failed (server continues)', { error: migErr.message });
      }
    }

    // Start HTTP server
    server.listen(PORT, HOST, () => {
      logger.info(`PLA Backend server started`, {
        host: HOST,
        port: PORT,
        env: process.env.NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid
      });

      // Log startup info
      logger.info('Server ready to accept connections');
      logger.info(`Health check: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/health`);
      logger.info(`Metrics: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/metrics`);
      logger.info(`API docs: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api`);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { server, io };