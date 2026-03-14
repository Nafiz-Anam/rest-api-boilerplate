import { Router } from 'express';
import { authenticateJWT } from '../../config/passport';
import { authRateLimiter } from '../../middleware/security';

// Import routes
import authRoutes from './auth';
import userRoutes from './users';
import postRoutes from './posts';
import deviceRoutes from './devices';
import twoFactorRoutes from './twoFactor';
import fileRoutes from './files';
import adminRoutes from './admin';
import authSwaggerRoutes from './authSwagger';

const router = Router();

// API routes with versioning
router.use('/auth', authRateLimiter, authRoutes);
router.use('/users', authenticateJWT, userRoutes);
router.use('/posts', postRoutes);
router.use('/devices', deviceRoutes);
router.use('/2fa', twoFactorRoutes);
router.use('/files', authenticateJWT, fileRoutes);
router.use('/admin', adminRoutes);
router.use('/auth-swagger', authSwaggerRoutes);

export default router;
