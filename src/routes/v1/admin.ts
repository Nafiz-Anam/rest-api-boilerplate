import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import {
  authenticateToken,
  requirePermission,
  requireRole,
  requireMinimumRole,
  AuthenticatedRequest,
} from '../middleware/auth';
import { Role, getAssignableRoles, canManageRole } from '../config/role';
import { validate } from '../utils/validation';
import { Router, type Router as RouterType } from 'express';
import { asyncHandler } from '../utils/asyncHandler';

const router: RouterType = Router();

// All admin routes require minimum admin role
router.use(requireMinimumRole(Role.ADMIN));

// Get system statistics
router.get(
  '/stats',
  requirePermission('read:analytics'),
  asyncHandler(async (req: AuthenticatedRequest, res: any) => {
    try {
      const [
        totalUsers,
        totalPosts,
        totalComments,
        publishedPosts,
        activeUsers,
        recentActivity,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.post.count(),
        prisma.comment.count(),
        prisma.post.count({ where: { published: true } }),
        prisma.user.count({ where: { isActive: true } }),
        prisma.activityLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                role: true,
              },
            },
          },
        }),
      ]);

      const stats = {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
        },
        posts: {
          total: totalPosts,
          published: publishedPosts,
          drafts: totalPosts - publishedPosts,
        },
        comments: totalComments,
        recentActivity,
      };

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error('Failed to fetch admin stats:', error);
      res.status(500).json({
        error: 'Failed to fetch statistics',
        code: 'STATS_ERROR',
      });
    }
  })
);

// Get all users with pagination and filtering
router.get(
  '/users',
  requirePermission('read:any_user'),
  validate({
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z
      .string()
      .transform(Number)
      .pipe(z.number().min(1).max(100))
      .optional(),
    role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
    isActive: z.string().transform(Boolean).optional(),
    search: z.string().optional(),
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: any) => {
    try {
      const { page = 1, limit = 20, role, isActive, search } = req.query;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (role) {
        where.role = role;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                posts: true,
                comments: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Failed to fetch users:', error);
      res.status(500).json({
        error: 'Failed to fetch users',
        code: 'USERS_ERROR',
      });
    }
  })
);

// Update user role
router.put(
  '/users/:id/role',
  requirePermission('manage:roles'),
  validate({
    role: z.enum(['USER', 'MODERATOR', 'ADMIN']),
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const newRole = role as Role;

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, email: true },
      });

      if (!targetUser) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Prevent self-role modification for safety
      if (id === req.user!.id) {
        return res.status(400).json({
          error: 'Cannot modify your own role',
          code: 'SELF_MODIFICATION',
        });
      }

      // Check if the current user can manage this role transition
      if (
        !canManageRole(req.user!.role, targetUser.role as Role) ||
        !canManageRole(req.user!.role, newRole)
      ) {
        return res.status(403).json({
          error: 'Insufficient privileges to manage this role',
          code: 'INSUFFICIENT_PRIVILEGES',
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role: newRole },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          updatedAt: true,
        },
      });

      // Log the role change
      await prisma.activityLog.create({
        data: {
          action: 'role_updated',
          entityType: 'user',
          entityId: id,
          oldValues: { role: targetUser.role },
          newValues: { role: newRole },
          userId: req.user!.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });

      logger.info(
        `User role updated: ${targetUser.email} from ${targetUser.role} to ${newRole} by ${req.user!.username}`
      );

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: { user: updatedUser },
      });
    } catch (error) {
      logger.error('Failed to update user role:', error);
      res.status(500).json({
        error: 'Failed to update user role',
        code: 'ROLE_UPDATE_ERROR',
      });
    }
  })
);

// Deactivate/activate user
router.put(
  '/users/:id/status',
  requirePermission('update:any_user'),
  validate({
    isActive: z.boolean(),
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      // Prevent self-deactivation
      if (id === req.user!.id && !isActive) {
        return res.status(400).json({
          error: 'Cannot deactivate your own account',
          code: 'SELF_DEACTIVATION',
        });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, isActive: true, email: true },
      });

      if (!targetUser) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          email: true,
          username: true,
          isActive: true,
          updatedAt: true,
        },
      });

      // Log the status change
      await prisma.activityLog.create({
        data: {
          action: isActive ? 'user_activated' : 'user_deactivated',
          entityType: 'user',
          entityId: id,
          oldValues: { isActive: targetUser.isActive },
          newValues: { isActive },
          userId: req.user!.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });

      logger.info(
        `User ${isActive ? 'activated' : 'deactivated'}: ${targetUser.email} by ${req.user!.username}`
      );

      res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: { user: updatedUser },
      });
    } catch (error) {
      logger.error('Failed to update user status:', error);
      res.status(500).json({
        error: 'Failed to update user status',
        code: 'STATUS_UPDATE_ERROR',
      });
    }
  })
);

// Get system logs
router.get(
  '/logs',
  requirePermission('read:system_logs'),
  validate({
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z
      .string()
      .transform(Number)
      .pipe(z.number().min(1).max(100))
      .optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    userId: z.string().optional(),
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: any) => {
    try {
      const { page = 1, limit = 50, action, entityType, userId } = req.query;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (action) {
        where.action = action;
      }

      if (entityType) {
        where.entityType = entityType;
      }

      if (userId) {
        where.userId = userId;
      }

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.activityLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Failed to fetch system logs:', error);
      res.status(500).json({
        error: 'Failed to fetch system logs',
        code: 'LOGS_ERROR',
      });
    }
  })
);

// Get assignable roles for current user
router.get(
  '/roles/assignable',
  requirePermission('manage:roles'),
  asyncHandler(async (req: AuthenticatedRequest, res: any) => {
    try {
      const assignableRoles = getAssignableRoles(req.user!.role);

      res.json({
        success: true,
        data: {
          currentRole: req.user!.role,
          assignableRoles,
        },
      });
    } catch (error) {
      logger.error('Failed to get assignable roles:', error);
      res.status(500).json({
        error: 'Failed to get assignable roles',
        code: 'ROLES_ERROR',
      });
    }
  })
);

export default router;
