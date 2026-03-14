import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { authenticateToken, requirePermission } from '../../middleware/auth';
import {
  revokeSession,
  revokeAllSessions,
  cleanupExpiredSessions,
} from '../../utils/deviceManager';
import { validate } from '../../utils/validation';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// All device routes require authentication
router.use(authenticateToken);

// Get user's active devices with filtering and pagination
router.get(
  '/',
  requirePermission('read:own_profile'),
  validate(
    {
      deviceType: z.enum(['mobile', 'desktop', 'tablet']).optional(),
      isActive: z
        .enum(['true', 'false'])
        .transform(val => val === 'true')
        .optional(),
      platform: z.string().optional(),
      browser: z.string().optional(),
      page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
      limit: z
        .string()
        .transform(Number)
        .pipe(z.number().min(1).max(100))
        .default('20'),
      sortBy: z
        .enum(['createdAt', 'lastUsedAt', 'deviceName'])
        .default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    },
    'query'
  ),
  asyncHandler(async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const {
        deviceType,
        isActive,
        platform,
        browser,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build where clause with filters
      const where: any = { userId };

      if (deviceType) {
        where.deviceType = deviceType;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (platform) {
        where.platform = { contains: platform, mode: 'insensitive' };
      }

      if (browser) {
        where.browser = { contains: browser, mode: 'insensitive' };
      }

      const skip = (page - 1) * limit;

      const [devices, total] = await Promise.all([
        prisma.device.findMany({
          where,
          include: {
            sessions: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                isActive: true,
                createdAt: true,
                expiresAt: true,
                ipAddress: true,
                userAgent: true,
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.device.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: {
          devices: devices.map(device => ({
            id: device.id,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            deviceType: device.deviceType,
            platform: device.platform,
            browser: device.browser,
            isActive: device.isActive,
            lastUsedAt: device.lastUsedAt,
            createdAt: device.createdAt,
            sessions:
              device.sessions?.map(session => ({
                id: session.id,
                isActive: session.isActive,
                createdAt: session.createdAt,
                expiresAt: session.expiresAt,
                ipAddress: session.ipAddress,
                userAgent: session.userAgent,
              })) || [],
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to fetch devices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch devices',
        code: 'DEVICES_ERROR',
      });
    }
  })
);

// Revoke a specific session
router.delete(
  '/sessions/:sessionId',
  requirePermission('read:own_profile'),
  validate(
    {
      sessionId: z.string().min(1, 'Session ID is required'),
    },
    'params'
  ),
  asyncHandler(async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = req.params;

      const success = await revokeSession(sessionId, userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }

      logger.info(`Session revoked: ${sessionId} by user: ${userId}`);

      res.json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (error: any) {
      logger.error('Failed to revoke session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke session',
        code: 'SESSION_REVOKE_ERROR',
      });
    }
  })
);

// Revoke all sessions (logout from all devices)
router.delete(
  '/sessions',
  requirePermission('read:own_profile'),
  asyncHandler(async (req: any, res: any) => {
    try {
      const userId = req.user!.id;

      await revokeAllSessions(userId);

      logger.info(`All sessions revoked for user: ${userId}`);

      res.json({
        success: true,
        message: 'All sessions revoked successfully',
      });
    } catch (error: any) {
      logger.error('Failed to revoke all sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke all sessions',
        code: 'SESSIONS_REVOKE_ERROR',
      });
    }
  })
);

// Deactivate a device
router.delete(
  '/:deviceId',
  requirePermission('read:own_profile'),
  validate(
    {
      deviceId: z.string().min(1, 'Device ID is required'),
    },
    'params'
  ),
  asyncHandler(async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const { deviceId } = req.params;

      // Find the device
      const device = await prisma.device.findFirst({
        where: {
          userId,
          deviceId,
          isActive: true,
        },
        include: {
          sessions: true,
        },
      });

      if (!device) {
        return res.status(404).json({
          success: false,
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND',
        });
      }

      // Deactivate all sessions for this device
      await prisma.session.updateMany({
        where: {
          deviceId: device.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Deactivate the device
      await prisma.device.update({
        where: { id: device.id },
        data: { isActive: false },
      });

      logger.info(
        `Device deactivated: ${device.deviceName} (${device.deviceId}) by user: ${userId}`
      );

      res.json({
        success: true,
        message: 'Device deactivated successfully',
      });
    } catch (error: any) {
      logger.error('Failed to deactivate device:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate device',
        code: 'DEVICE_DEACTIVATE_ERROR',
      });
    }
  })
);

// Get session statistics
router.get(
  '/stats',
  requirePermission('read:own_profile'),
  asyncHandler(async (req: any, res: any) => {
    try {
      const userId = req.user!.id;

      const [
        totalDevices,
        activeDevices,
        totalSessions,
        activeSessions,
        mobileDevices,
        desktopDevices,
      ] = await Promise.all([
        prisma.device.count({ where: { userId } }),
        prisma.device.count({
          where: { userId, isActive: true },
        }),
        prisma.session.count({ where: { userId } }),
        prisma.session.count({
          where: {
            userId,
            isActive: true,
            expiresAt: { gt: new Date() },
          },
        }),
        prisma.device.count({
          where: { userId, deviceType: 'mobile', isActive: true },
        }),
        prisma.device.count({
          where: { userId, deviceType: 'desktop', isActive: true },
        }),
      ]);

      const stats = {
        devices: {
          total: totalDevices,
          active: activeDevices,
          mobile: mobileDevices,
          desktop: desktopDevices,
          tablet: activeDevices - mobileDevices - desktopDevices,
        },
        sessions: {
          total: totalSessions,
          active: activeSessions,
        },
      };

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error: any) {
      logger.error('Failed to fetch device stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch device statistics',
        code: 'STATS_ERROR',
      });
    }
  })
);

// Admin-only endpoint to clean up expired sessions
router.post(
  '/cleanup',
  requirePermission('read:system_logs'),
  asyncHandler(async (req: any, res: any) => {
    try {
      await cleanupExpiredSessions();

      logger.info(`Session cleanup performed by admin: ${req.user!.id}`);

      res.json({
        success: true,
        message: 'Expired sessions cleaned up successfully',
      });
    } catch (error: any) {
      logger.error('Failed to cleanup sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired sessions',
        code: 'CLEANUP_ERROR',
      });
    }
  })
);

export default router;
