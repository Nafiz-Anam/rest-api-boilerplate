import * as express from 'express';
import {
  authenticateLocal,
  authenticateGoogle,
  authenticateGitHub,
  authorize,
} from '../config/passport';
import { prisma } from '../config/prisma';
import * as bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { validate, authSchemas } from '../validation';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../config/logger';
import {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
} from '../controllers/authController';

const router = express.Router() as express.Router;

// Register new user
router.post('/register', validate(authSchemas.register, 'body'), register);

// Login user
router.post('/login', validate(authSchemas.login, 'body'), login);

// Refresh access token
router.post('/refresh', refreshToken);

// Logout user
router.post('/logout', logout);

// Get current user profile
router.get('/profile', authenticateLocal, getProfile);

// Google OAuth routes
router.get('/google', authenticateGoogle);

router.get(
  '/google/callback',
  authenticateGoogle,
  asyncHandler(async (req, res) => {
    const user = req.user;

    logger.info(`User authenticated via Google: ${user.email}`);

    // Generate tokens
    const accessToken = (jwt as any).sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      }
    );
    const refreshToken = (jwt as any).sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      }
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.CORS_ORIGIN}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
    res.redirect(redirectUrl);
  })
);

// GitHub OAuth routes
router.get('/github', authenticateGitHub);

router.get(
  '/github/callback',
  authenticateGitHub,
  asyncHandler(async (req, res) => {
    const user = req.user;

    logger.info(`User authenticated via GitHub: ${user.email}`);

    // Generate tokens
    const accessToken = (jwt as any).sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      }
    );
    const refreshToken = (jwt as any).sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      }
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.CORS_ORIGIN}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
    res.redirect(redirectUrl);
  })
);

// Admin-only route example
router.get(
  '/admin/users',
  authenticateLocal,
  authorize(['ADMIN']),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { users },
    });
  })
);

// Helper functions
function generateAccessToken(userId: string): string {
  return (jwt as any).sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function generateRefreshToken(userId: string): string {
  return (jwt as any).sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
}

export default router;
