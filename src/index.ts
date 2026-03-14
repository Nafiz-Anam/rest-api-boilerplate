import express, { type Express } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import compression from 'compression';
import morgan from 'morgan';
import passport from 'passport';
import cors from 'cors';
import { setTimeout } from 'timers';

// Import configurations
import { prisma } from './config/prisma';
import logger, { logStream } from './config/logger';
import sessionConfig from './config/session';

// Import middleware
import {
  helmetConfig,
  corsOptions,
  rateLimiter,
  securityHeaders,
} from './middleware/security';
import {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,
} from './middleware/errorHandler';
import { setupSwagger } from './middleware/swagger';

// Import services
import { websocketService } from './services/websocket';

// Import routes
import v1Routes from './routes/v1';

// Load environment variables

dotenv.config();

const app: Express = express();
const server = createServer(app);

// Setup global error handlers
setupGlobalErrorHandlers();

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Passport initialization
app.use(passport.initialize());
app.use(sessionConfig);

// Security middleware
app.use(helmetConfig);
app.use(securityHeaders);
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', { stream: logStream }));

// Rate limiting
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes
app.use('/v1', v1Routes);

// Setup Swagger documentation
setupSwagger(app);

// WebSocket connection info endpoint
app.get('/api/websocket/info', (req, res) => {
  res.json({
    connectedUsers: websocketService.getConnectedUsersCount(),
    message: 'WebSocket service is running',
    connectionUrl: `${req.protocol}://${req.get('host')}`,
    authRequired: true,
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Production Ready REST API',
    version: '1.0.0',
    description:
      'A production-ready REST API boilerplate with authentication, real-time features, and comprehensive security',
    endpoints: {
      health: '/health',
      websocket: '/api/websocket/info',
      v1: {
        auth: '/v1/auth',
        users: '/v1/users',
        posts: '/v1/posts',
        devices: '/v1/devices',
        twoFactor: '/v1/2fa',
        files: '/v1/files',
        admin: '/v1/admin',
        authSwagger: '/v1/auth-swagger',
      },
    },
    documentation:
      'https://github.com/your-repo/productionready-rest-api-boilerplate',
    features: [
      'JWT Authentication',
      'Role-based Authorization',
      'Real-time WebSocket Events',
      'Data Validation with Zod',
      'Rate Limiting',
      'Security Headers',
      'Comprehensive Logging',
      'Prisma ORM',
      'Pagination & Sorting',
      'Error Handling',
      'File Upload & Management',
      'API Versioning',
    ],
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize WebSocket service
websocketService.initialize(server);

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Starting graceful shutdown...');

  // Close HTTP server
  server.close(async () => {
    logger.info('HTTP server closed');

    // Disconnect from database
    await prisma.$disconnect();
    logger.info('Database disconnected');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Start listening
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API documentation: http://localhost:${PORT}/api`);
      logger.info('WebSocket ready for connections');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
