import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import logger from '../config/logger';
import * as bcryptjs from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler';

// Validation schemas
const userSchemas = {
  updateProfile: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    avatar: z.string().url().optional(),
    bio: z.string().max(500).optional(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8)
      .max(100)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&].{8,}$/,
        'Password must contain at least 8 characters, including uppercase, lowercase, number and special character'
      ),
  }),

  search: z.object({
    query: z.string().min(1).max(100).optional(),
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z
      .string()
      .transform(Number)
      .pipe(z.number().min(1).max(100))
      .optional(),
    sortBy: z.enum(['username', 'createdAt', 'updatedAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),

  updateStatus: z.object({
    isActive: z.boolean(),
  }),
};

/**
 * Get current user profile
 * @swagger
 * tags:
 *   - Users
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
        bio: true,
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

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: { user },
    });
  } catch (error: any) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * Update user profile
 * @swagger
 * tags:
 *   - Users
 * summary: Update user profile
 * description: Update the authenticated user's profile information
 * security:
 *   - bearerAuth: []
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         properties:
 *           firstName:
 *             type: string
 *             description: User first name
 *             example: John
 *           lastName:
 *             type: string
 *             description: User last name
 *             example: Doe
 *           avatar:
 *             type: string
 *             format: uri
 *             description: Profile avatar URL
 *             example: https://example.com/avatar.jpg
 *           bio:
 *             type: string
 *             description: User biography
 *             example: Software developer passionate about creating amazing applications.
 * responses:
 *   200:
 *     description: Profile updated successfully
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
 *   404:
 *     description: User not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { firstName, lastName, avatar, bio } =
        userSchemas.updateProfile.parse(req.body);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'No valid token provided',
          code: 'TOKEN_MISSING',
        });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

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

      logger.info(`Profile updated for user: ${userId}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser },
      });
    } catch (error: any) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * Change user password
 * @swagger
 * tags:
 *   - Users
 * summary: Change password
 * description: Change the authenticated user's password
 * security:
 *   - bearerAuth: []
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - currentPassword
 *           - newPassword
 *         properties:
 *           currentPassword:
 *             type: string
 *             description: Current password
 *             example: oldpassword123
 *           newPassword:
 *             type: string
 *             minLength: 8
 *             description: New password
 *             example: newpassword123
 * responses:
 *   200:
 *     description: Password changed successfully
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
 *   401:
 *     description: Unauthorized - Invalid current password
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
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { currentPassword, newPassword } = userSchemas.changePassword.parse(
        req.body
      );

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'No valid token provided',
          code: 'TOKEN_MISSING',
        });
      }

      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Verify current password
      const isValidPassword = await bcryptjs.compare(
        currentPassword,
        user.password!
      );
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD',
        });
      }

      // Hash new password
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info(`Password changed for user: ${userId}`);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * Search users (Admin only)
 * @swagger
 * tags:
 *   - Users
 * summary: Search users
 * description: Search for users by various criteria (Admin only)
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: query
 *     name: query
 *     schema:
 *       type: string
 *     description: Search query
 *   - in: query
 *     name: page
 *     schema:
 *       type: integer
 *       description: Page number
 *   - in: query
 *     name: limit
 *     schema:
 *       type: integer
 *       description: Number of results per page
 *   - in: query
 *     name: sortBy
 *     schema:
 *       type: string
 *       enum: [username, createdAt, updatedAt]
 *       description: Sort field
 *   - in: query
 *     name: sortOrder
 *     schema:
 *       type: string
 *       enum: [asc, desc]
 *       description: Sort order
 * responses:
 *   200:
 *     description: Users retrieved successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/PaginatedResponse'
 *   400:
 *     description: Bad request - Invalid search parameters
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   403:
 *     description: Forbidden - Admin access required
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */
export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      query,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = userSchemas.search.parse(req.query);
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const where = query
      ? {
          OR: [
            { username: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
            { firstName: { contains: query, mode: 'insensitive' as const } },
            { lastName: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
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
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.user.count({ where });

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        items: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * Get user by ID (Admin only)
 * @swagger
 * tags:
 *   - Users
 * summary: Get user by ID
 * description: Retrieve a specific user by their ID (Admin only)
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: User ID
 * responses:
 *   200:
 *     description: User retrieved successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   403:
 *     description: Forbidden - Admin access required
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
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
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

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: { user },
    });
  } catch (error: any) {
    logger.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * Update user status (Admin only)
 * @swagger
 * tags:
 *   - Users
 * summary: Update user status
 * description: Update a user's active/inactive status (Admin only)
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: User ID
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - isActive
 *         properties:
 *           isActive:
 *             type: boolean
 *             description: User active status
 *             example: true
 * responses:
 *   200:
 *     description: User status updated successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   403:
 *     description: Forbidden - Admin access required
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
export const updateUserStatus = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isActive } = userSchemas.updateStatus.parse(req.body);
      const userRole = (req as any).user?.role;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, username: true },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          username: true,
          isActive: true,
          updatedAt: true,
        },
      });

      logger.info(
        `User status updated: ${existingUser.username} -> ${isActive ? 'active' : 'inactive'}`
      );

      res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: { user: updatedUser },
      });
    } catch (error: any) {
      logger.error('Update user status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * Delete user (Admin only)
 * @swagger
 * tags:
 *   - Users
 * summary: Delete user
 * description: Delete a user account (Admin only)
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: User ID
 * responses:
 *   200:
 *     description: User deleted successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   403:
 *     description: Forbidden - Admin access required
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
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id },
    });

    logger.info(`User deleted: ${user.username}`);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});
