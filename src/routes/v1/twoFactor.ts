import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { authenticateJWT } from '../../config/passport';
import { validate } from '../../utils/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import TwoFactorAuthService from '../../services/twoFactorAuth';
import { sendEmail, EmailTemplates } from '../../config/email';

const router: RouterType = Router();

// 2FA validation schemas
const twoFactorSchemas = {
  requestOTP: z.object({
    email: z.string().email('Invalid email format'),
  }),

  verifyOTP: z.object({
    email: z.string().email('Invalid email format'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
  }),

  enable2FA: z.object({
    email: z.string().email('Invalid email format'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
  }),

  verifyBackupCode: z.object({
    backupCode: z.string().min(8).max(10, 'Invalid backup code format'),
  }),

  setup2FA: z.object({
    email: z.string().email('Invalid email format'),
  }),
};

// Request OTP for login verification
router.post(
  '/request-otp',
  validate(twoFactorSchemas.requestOTP),
  asyncHandler(async (req: any, res: any) => {
    const { email } = req.body;

    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, username: true, twoFactorEnabled: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Create OTP verification
      const result = await TwoFactorAuthService.createOTPVerification(
        user.id,
        email,
        user.username
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'OTP_REQUEST_FAILED',
        });
      }

      res.json({
        success: true,
        message: 'OTP sent to your email',
        data: {
          expiresIn: '10 minutes',
          attempts: 3,
        },
      });
    } catch (error) {
      logger.error('Error requesting OTP:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send OTP',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

// Verify OTP for login
router.post(
  '/verify-otp',
  validate(twoFactorSchemas.verifyOTP),
  asyncHandler(async (req: any, res: any) => {
    const { email, otp } = req.body;

    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, username: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Verify OTP
      const result = await TwoFactorAuthService.verifyOTP(user.id, otp);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'OTP_VERIFICATION_FAILED',
        });
      }

      res.json({
        success: true,
        message: 'OTP verified successfully',
        data: {
          verified: result.verified,
        },
      });
    } catch (error) {
      logger.error('Error verifying OTP:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify OTP',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

// Enable 2FA for user
router.post(
  '/enable',
  authenticateJWT,
  validate(twoFactorSchemas.enable2FA),
  asyncHandler(async (req: any, res: any) => {
    const { email, otp } = req.body;
    const userId = req.user!.id;

    try {
      // Verify OTP first
      const otpResult = await TwoFactorAuthService.verifyOTP(userId, otp);

      if (!otpResult.success) {
        return res.status(400).json({
          success: false,
          error: otpResult.error,
          code: 'OTP_VERIFICATION_FAILED',
        });
      }

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, email: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Enable 2FA
      const result = await TwoFactorAuthService.enableTwoFactor(
        userId,
        user.email,
        user.username
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'TWO_FACTOR_ENABLE_FAILED',
        });
      }

      res.json({
        success: true,
        message: 'Two-factor authentication enabled successfully',
        data: {
          twoFactorEnabled: true,
        },
      });
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to enable two-factor authentication',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

// Setup 2FA with backup codes
router.post(
  '/setup',
  authenticateJWT,
  validate(twoFactorSchemas.setup2FA),
  asyncHandler(async (req: any, res: any) => {
    const { email } = req.body;
    const userId = req.user!.id;

    try {
      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, email: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Setup 2FA with backup codes
      const result = await TwoFactorAuthService.setupTwoFactorWithBackup(
        userId,
        user.email,
        user.username
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'TWO_FACTOR_SETUP_FAILED',
        });
      }

      res.json({
        success: true,
        message: 'Two-factor authentication setup completed',
        data: {
          twoFactorEnabled: true,
          backupCodes: result.backupCodes,
        },
      });
    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup two-factor authentication',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

// Disable 2FA
router.post(
  '/disable',
  authenticateJWT,
  asyncHandler(async (req: any, res: any) => {
    const userId = req.user!.id;

    try {
      // Get user info for logging
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Disable 2FA
      const result = await TwoFactorAuthService.disableTwoFactor(userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'TWO_FACTOR_DISABLE_FAILED',
        });
      }

      res.json({
        success: true,
        message: 'Two-factor authentication disabled successfully',
        data: {
          twoFactorEnabled: false,
        },
      });
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disable two-factor authentication',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

// Verify backup code
router.post(
  '/verify-backup-code',
  authenticateJWT,
  validate(twoFactorSchemas.verifyBackupCode),
  asyncHandler(async (req: any, res: any) => {
    const { backupCode } = req.body;
    const userId = req.user!.id;

    try {
      // Verify backup code
      const result = await TwoFactorAuthService.verifyBackupCode(
        userId,
        backupCode
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'BACKUP_CODE_INVALID',
        });
      }

      res.json({
        success: true,
        message: 'Backup code verified successfully',
        data: {
          verified: true,
        },
      });
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify backup code',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

// Get 2FA status
router.get(
  '/status',
  authenticateJWT,
  asyncHandler(async (req: any, res: any) => {
    const userId = req.user!.id;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          twoFactorEnabled: true,
          backupCodes: true,
          backupCodesUsed: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const backupCodes = (user.backupCodes as string[]) || [];
      const backupCodesUsed = (user.backupCodesUsed as number[]) || [];
      const remainingBackupCodes = backupCodes.length - backupCodesUsed.length;

      res.json({
        success: true,
        data: {
          twoFactorEnabled: user.twoFactorEnabled,
          backupCodesConfigured: backupCodes.length > 0,
          remainingBackupCodes,
          totalBackupCodes: backupCodes.length,
        },
      });
    } catch (error) {
      logger.error('Error getting 2FA status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get 2FA status',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

// Regenerate backup codes
router.post(
  '/regenerate-backup-codes',
  authenticateJWT,
  asyncHandler(async (req: any, res: any) => {
    const userId = req.user!.id;

    try {
      // Check if 2FA is enabled
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          twoFactorEnabled: true,
          username: true,
          email: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      if (!user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          error: 'Two-factor authentication must be enabled first',
          code: 'TWO_FACTOR_NOT_ENABLED',
        });
      }

      // Generate new backup codes
      const backupCodes = TwoFactorAuthService.generateBackupCodes();

      // Update user with new backup codes
      await prisma.user.update({
        where: { id: userId },
        data: {
          backupCodes,
          backupCodesUsed: [],
        },
      });

      // Send notification email
      const emailSent = await sendEmail({
        ...EmailTemplates.twoFactorEnabled(user.username),
        to: user.email,
      });

      if (!emailSent) {
        logger.warn(
          `Failed to send backup codes notification to ${user.email}`
        );
      }

      res.json({
        success: true,
        message: 'Backup codes regenerated successfully',
        data: {
          backupCodes,
          totalBackupCodes: backupCodes.length,
        },
      });
    } catch (error) {
      logger.error('Error regenerating backup codes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to regenerate backup codes',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

// Clean up expired OTPs (Admin only)
router.post(
  '/cleanup',
  authenticateJWT,
  asyncHandler(async (req: any, res: any) => {
    try {
      // Check if user is admin
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { role: true },
      });

      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Clean up expired OTPs
      await TwoFactorAuthService.cleanupExpiredOTPs();

      res.json({
        success: true,
        message: 'Expired OTPs cleaned up successfully',
      });
    } catch (error) {
      logger.error('Error cleaning up expired OTPs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired OTPs',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

export default router;
