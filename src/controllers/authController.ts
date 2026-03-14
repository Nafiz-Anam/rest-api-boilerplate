import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import logger from '../config/logger';
import { authSchemas } from '../validation';
import { RegisterInput, LoginInput, RefreshTokenInput } from '../types/auth';
import * as bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/response';
import { StatusCodes, ErrorCodes, Messages } from '../utils/constants';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from '../middleware/errorHandler';
import {
  getDeviceInfo,
  canCreateSession,
  createSession,
  invalidateOldestSession,
  revokeAllSessions,
  DEFAULT_SESSION_LIMITS,
} from '../utils/deviceManager';

export const register = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, username, password, firstName, lastName } =
      authSchemas.register.parse(req.body) as RegisterInput;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error:
          existingUser.email === email
            ? 'Email already registered'
            : 'Username already taken',
        code: 'USER_EXISTS',
      });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    logger.info(`User registered: ${email}`);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user },
    });
  } catch (error: any) {
    logger.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, password } = authSchemas.login.parse(req.body) as LoginInput;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        password: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Verify password
    const isValidPassword = await bcryptjs.compare(password, user.password!);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Get device information
    const deviceInfo = getDeviceInfo(req);

    // Check if user can create a new session
    const sessionCheck = await canCreateSession(user.id, deviceInfo);

    if (!sessionCheck.canCreate) {
      // Check if we should invalidate an old session based on device type
      const existingDevices = sessionCheck.existingDevices || [];
      const mobileDevices = existingDevices.filter(
        d => d.deviceType === 'mobile'
      );
      const desktopDevices = existingDevices.filter(
        d => d.deviceType === 'desktop'
      );

      // If this is a mobile device and user already has one, invalidate the oldest mobile session
      if (deviceInfo.deviceType === 'mobile' && mobileDevices.length >= 1) {
        await invalidateOldestSession(user.id, 'mobile');
      }
      // If this is a desktop device and user already has 2, invalidate the oldest desktop session
      else if (
        deviceInfo.deviceType === 'desktop' &&
        desktopDevices.length >= 2
      ) {
        await invalidateOldestSession(user.id, 'desktop');
      }
      // If still can't create session, return error
      else {
        return res.status(429).json({
          success: false,
          error: sessionCheck.reason || 'Maximum device limit exceeded',
          code: 'DEVICE_LIMIT_EXCEEDED',
          data: {
            currentDevices: existingDevices.map(d => ({
              deviceName: d.deviceName,
              deviceType: d.deviceType,
              lastUsedAt: d.lastUsedAt,
            })),
          },
        });
      }
    }

    // Generate JWT tokens
    const accessToken = (jwt as any).sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = (jwt as any).sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    // Create device and session
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    await createSession(
      user.id,
      deviceInfo,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent,
      process.env.JWT_EXPIRES_IN || '7d'
    );

    logger.info(`User logged in: ${email} from ${deviceInfo.deviceName}`);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        },
        device: {
          deviceName: deviceInfo.deviceName,
          deviceType: deviceInfo.deviceType,
        },
      },
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = authSchemas.refreshToken.parse(
        req.body
      ) as RefreshTokenInput;

      // Find refresh token in database
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              role: true,
            },
          },
        },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        });
      }

      // Generate new access token
      const accessToken = (jwt as any).sign(
        {
          userId: storedToken.user.id,
          email: storedToken.user.email,
          role: storedToken.user.role,
        },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Remove old refresh token and create new one
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      await prisma.refreshToken.create({
        data: {
          userId: storedToken.user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Token refreshed for user: ${storedToken.user.email}`);

      return res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: storedToken.user,
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          },
        },
      });
    } catch (error: any) {
      logger.error('Token refresh error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

export const logout = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No valid token provided',
        code: 'TOKEN_MISSING',
      });
    }

    // Get the current session token from authorization header
    const authHeader = req.get('Authorization');
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token) {
      // Find and deactivate the specific session
      const session = await prisma.session.findFirst({
        where: {
          userId,
          token,
          isActive: true,
        },
      });

      if (session) {
        // Deactivate the session
        await prisma.session.update({
          where: { id: session.id },
          data: { isActive: false },
        });

        // Check if device has any other active sessions
        const remainingSessions = await prisma.session.count({
          where: {
            deviceId: session.deviceId,
            isActive: true,
            expiresAt: {
              gt: new Date(),
            },
          },
        });

        // If no more active sessions, deactivate the device
        if (remainingSessions === 0) {
          await prisma.device.update({
            where: { id: session.deviceId },
            data: { isActive: false },
          });
        }

        logger.info(`User logged out: ${userId} from session ${session.id}`);
      } else {
        // If session not found, still log out all sessions as fallback
        await revokeAllSessions(userId);
        logger.info(
          `User logged out all sessions: ${userId} (session not found)`
        );
      }
    } else {
      // No token provided, revoke all sessions
      await revokeAllSessions(userId);
      logger.info(`User logged out all sessions: ${userId} (no token)`);
    }

    return res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error: any) {
    logger.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No valid token provided',
        code: 'TOKEN_MISSING',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: { user },
    });
  } catch (error: any) {
    logger.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/*
 * SWAGGER API DOCUMENTATION
 * =========================
 *
 * Register a new user
 * @swagger
 * tags:
 *   - Authentication
 * summary: User registration
 * description: Register a new user account with email, username, and password
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - email
 *           - username
 *           - password
 *         properties:
 *           email:
 *             type: string
 *             format: email
 *             description: User email address
 *             example: user@example.com
 *           username:
 *             type: string
 *             description: Unique username
 *             example: john_doe
 *           password:
 *             type: string
 *             minLength: 8
 *             description: Secure password
 *             example: password123
 *           firstName:
 *             type: string
 *             description: User first name
 *             example: John
 *           lastName:
 *             type: string
 *             description: User last name
 *             example: Doe
 * responses:
 *   201:
 *     description: User registered successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   400:
 *     description: Bad request - Invalid input data
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   409:
 *     description: Conflict - User already exists
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * User login
 * @swagger
 * tags:
 *   - Authentication
 * summary: User login
 * description: Authenticate user with email and password
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - email
 *           - password
 *         properties:
 *           email:
 *             type: string
 *             format: email
 *             description: User email address
 *             example: user@example.com
 *           password:
 *             type: string
 *             description: User password
 *             example: password123
 * responses:
 *   200:
 *     description: Login successful
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   400:
 *     description: Bad request - Invalid credentials
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   401:
 *     description: Unauthorized - Invalid credentials
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   404:
 *     description: User not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Refresh access token
 * @swagger
 * tags:
 *   - Authentication
 * summary: Refresh access token
 * description: Generate new access token using refresh token
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - refreshToken
 *         properties:
 *           refreshToken:
 *             type: string
 *             description: Refresh token
 *             example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * responses:
 *   200:
 *     description: Token refreshed successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   400:
 *     description: Bad request - Invalid refresh token
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   401:
 *     description: Unauthorized - Invalid or expired refresh token
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * User logout
 * @swagger
 * tags:
 *   - Authentication
 * summary: User logout
 * description: Logout user and invalidate refresh token
 * security:
 *   - bearerAuth: []
 * responses:
 *   200:
 *     description: Logout successful
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   401:
 *     description: Unauthorized - No valid token provided
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Get current user profile
 * @swagger
 * tags:
 *   - Authentication
 * summary: Get user profile
 * description: Retrieve the authenticated user's profile information
 * security:
 *   - bearerAuth: []
 * responses:
 *   200:
 *     description: User profile retrieved successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   404:
 *     description: User not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */
