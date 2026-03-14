import * as express from 'express';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { authenticateJWT, authorize } from '../../config/passport';
import { AuthenticatedRequest } from '../../middleware/auth';
import { validate } from '../../utils/validation';
import { paginateResults } from '../../utils/pagination';
import { asyncHandler } from '../../utils/asyncHandler';
import { userSchemas } from '../../validation';
import * as bcryptjs from 'bcryptjs';

const router: express.Router = express.Router();

// Get current user profile
router.get(
  '/profile',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: { user: req.user },
    });
  })
);

// Update user profile
router.put(
  '/profile',
  authenticateJWT,
  validate(userSchemas.updateProfile),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, avatar, bio } = req.body;
    const userId = (req.user as any)?.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(avatar && { avatar }),
        ...(bio !== undefined && { bio }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        role: true,
        updatedAt: true,
      },
    });

    logger.info(`User profile updated: ${updatedUser.username}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser },
    });
  })
);

// Change password
router.post(
  '/change-password',
  authenticateJWT,
  validate(userSchemas.changePassword),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = (req.user as any)?.id;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Verify current password
    const isValidPassword = await bcryptjs.compare(
      currentPassword,
      user.password || ''
    );

    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD',
      });
    }

    // Hash new password
    const hashedPassword = await bcryptjs.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed for user ID: ${userId}`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

// Get users list (Admin only) with comprehensive filtering
router.get(
  '/',
  authenticateJWT,
  authorize(['ADMIN']),
  validate(userSchemas.search),
  asyncHandler(async (req: any, res: any) => {
    const {
      query,
      role,
      isActive,
      createdAfter,
      createdBefore,
      lastLoginAfter,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build comprehensive where clause
    const where: any = {};

    // Search across multiple fields
    if (query) {
      where.OR = [
        { username: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Filter by role
    if (role) {
      where.role = role;
    }

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Filter by creation date range
    if (createdAfter) {
      where.createdAt = { ...where.createdAt, gte: new Date(createdAfter) };
    }

    if (createdBefore) {
      where.createdAt = { ...where.createdAt, lte: new Date(createdBefore) };
    }

    // Filter by last login date
    if (lastLoginAfter) {
      where.lastLoginAt = { gte: new Date(lastLoginAfter) };
    }

    // Execute query with pagination
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const pagination = await paginateResults(
      prisma.user,
      {
        page: Number(page),
        limit: Number(limit),
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc',
      },
      where,
      undefined,
      ['id', 'username', 'email', 'createdAt', 'updatedAt']
    );

    logger.info(`Admin fetched users list: ${users.length} users`);

    res.json({
      success: true,
      data: users,
      pagination,
    });
  })
);

export default router;
