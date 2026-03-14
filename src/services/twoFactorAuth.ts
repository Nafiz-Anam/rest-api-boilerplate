import * as speakeasy from 'speakeasy';
import { prisma } from '../config/prisma';
import logger from '../config/logger';
import { sendEmail, EmailTemplates } from '../config/email';

// OTP configuration
export interface OTPConfig {
  issuer: string;
  label: string;
  secret: string;
  digits?: number;
  period?: number;
  window?: number;
}

export interface OTPVerification {
  token: string;
  secret: string;
  expiresAt: Date;
  attempts: number;
  isVerified: boolean;
}

export class TwoFactorAuthService {
  private static readonly OTP_EXPIRY_MINUTES = 10;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly COOLDOWN_MINUTES = 2;

  /**
   * Generate a new OTP secret for a user
   */
  static generateSecret(): string {
    return speakeasy.generateSecret({
      name: 'Your App',
      issuer: 'Your App',
      length: 32,
    }).base32;
  }

  /**
   * Generate OTP token using secret
   */
  static generateOTP(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
      time: Math.floor(Date.now() / 1000),
      algorithm: 'sha1',
      digits: 6,
    });
  }

  /**
   * Verify OTP token against secret
   */
  static verifyOTPToken(
    secret: string,
    token: string,
    window?: number
  ): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: window || 2,
      time: Math.floor(Date.now() / 1000),
      algorithm: 'sha1',
      digits: 6,
    });
  }

  /**
   * Create and store OTP verification record
   */
  static async createOTPVerification(
    userId: string,
    email: string,
    userName: string
  ): Promise<{ success: boolean; otp?: string; error?: string }> {
    try {
      // Check if user already has a pending OTP
      const existingOTP = await prisma.oTPVerification.findFirst({
        where: {
          userId,
          isVerified: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (existingOTP) {
        // Check cooldown period
        const timeSinceLastOTP = Date.now() - existingOTP.createdAt.getTime();
        const cooldownMs = this.COOLDOWN_MINUTES * 60 * 1000;

        if (timeSinceLastOTP < cooldownMs) {
          const remainingTime = Math.ceil(
            (cooldownMs - timeSinceLastOTP) / (60 * 1000)
          );
          return {
            success: false,
            error: `Please wait ${remainingTime} minutes before requesting another OTP.`,
          };
        }

        // Delete existing OTP to create new one
        await prisma.oTPVerification.delete({
          where: { id: existingOTP.id },
        });
      }

      // Generate new OTP
      const secret = this.generateSecret();
      const otp = this.generateOTP(secret);

      // Store OTP verification record
      const expiresAt = new Date(
        Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000
      );

      await prisma.oTPVerification.create({
        data: {
          userId,
          secret,
          token: otp,
          expiresAt,
          attempts: 0,
          isVerified: false,
        },
      });

      // Send OTP email
      const emailSent = await sendEmail({
        ...EmailTemplates.otpVerification(otp, userName),
        to: email,
      });

      if (!emailSent) {
        return {
          success: false,
          error: 'Failed to send OTP email. Please try again.',
        };
      }

      logger.info(`OTP generated for user ${userId}, sent to ${email}`);

      return {
        success: true,
        otp,
      };
    } catch (error) {
      logger.error('Error creating OTP verification:', error);
      return {
        success: false,
        error: 'Failed to generate OTP. Please try again.',
      };
    }
  }

  /**
   * Verify OTP token
   */
  static async verifyOTP(
    userId: string,
    token: string
  ): Promise<{ success: boolean; error?: string; verified?: boolean }> {
    try {
      // Get OTP verification record
      const otpRecord = await prisma.oTPVerification.findFirst({
        where: {
          userId,
          isVerified: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpRecord) {
        return {
          success: false,
          error: 'Invalid or expired OTP. Please request a new one.',
        };
      }

      // Check maximum attempts
      if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
        return {
          success: false,
          error: 'Maximum OTP attempts exceeded. Please request a new OTP.',
        };
      }

      // Increment attempt count
      await prisma.oTPVerification.update({
        where: { id: otpRecord.id },
        data: {
          attempts: otpRecord.attempts + 1,
        },
      });

      // Verify the OTP
      const isValid = this.verifyOTP(otpRecord.secret, token);

      if (!isValid) {
        const remainingAttempts = this.MAX_ATTEMPTS - (otpRecord.attempts + 1);
        return {
          success: false,
          error: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
        };
      }

      // Mark OTP as verified
      await prisma.oTPVerification.update({
        where: { id: otpRecord.id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      logger.info(`OTP verified successfully for user ${userId}`);

      return {
        success: true,
        verified: true,
      };
    } catch (error) {
      logger.error('Error verifying OTP:', error);
      return {
        success: false,
        error: 'Failed to verify OTP. Please try again.',
      };
    }
  }

  /**
   * Check if user has valid verified OTP for session
   */
  static async hasValidOTP(userId: string): Promise<boolean> {
    try {
      const validOTP = await prisma.oTPVerification.findFirst({
        where: {
          userId,
          isVerified: true,
          verifiedAt: {
            gte: new Date(Date.now() - this.OTP_EXPIRY_MINUTES * 60 * 1000),
          },
        },
        orderBy: { verifiedAt: 'desc' },
      });

      return !!validOTP;
    } catch (error) {
      logger.error('Error checking valid OTP:', error);
      return false;
    }
  }

  /**
   * Enable 2FA for user
   */
  static async enableTwoFactor(
    userId: string,
    email: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if 2FA is already enabled
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found.',
        };
      }

      if (user.twoFactorEnabled) {
        return {
          success: false,
          error: 'Two-factor authentication is already enabled.',
        };
      }

      // Generate new secret for the user
      const secret = this.generateSecret();

      // Update user with 2FA settings
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
        },
      });

      // Send confirmation email
      const emailSent = await sendEmail({
        ...EmailTemplates.twoFactorEnabled(userName),
        to: email,
      });

      if (!emailSent) {
        logger.warn(`Failed to send 2FA confirmation email to ${email}`);
      }

      logger.info(`2FA enabled for user ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      return {
        success: false,
        error: 'Failed to enable two-factor authentication.',
      };
    }
  }

  /**
   * Disable 2FA for user
   */
  static async disableTwoFactor(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found.',
        };
      }

      if (!user.twoFactorEnabled) {
        return {
          success: false,
          error: 'Two-factor authentication is not enabled.',
        };
      }

      // Disable 2FA
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });

      // Clean up any existing OTP verifications
      await prisma.oTPVerification.deleteMany({
        where: { userId },
      });

      logger.info(`2FA disabled for user ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      return {
        success: false,
        error: 'Failed to disable two-factor authentication.',
      };
    }
  }

  /**
   * Generate backup codes for user
   */
  static generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  /**
   * Setup 2FA with backup codes
   */
  static async setupTwoFactorWithBackup(
    userId: string,
    email: string,
    userName: string
  ): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
    try {
      const secret = this.generateSecret();
      const backupCodes = this.generateBackupCodes();

      // Update user with 2FA settings and backup codes
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          backupCodes: backupCodes,
        },
      });

      // Send confirmation email with backup codes
      const emailSent = await sendEmail({
        ...EmailTemplates.twoFactorEnabled(userName),
        to: email,
      });

      if (!emailSent) {
        logger.warn(`Failed to send 2FA confirmation email to ${email}`);
      }

      logger.info(`2FA setup completed for user ${userId} with backup codes`);

      return {
        success: true,
        backupCodes,
      };
    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      return {
        success: false,
        error: 'Failed to setup two-factor authentication.',
      };
    }
  }

  /**
   * Verify backup code
   */
  static async verifyBackupCode(
    userId: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { backupCodes: true, backupCodesUsed: true },
      });

      if (!user || !user.backupCodes) {
        return {
          success: false,
          error: 'No backup codes available.',
        };
      }

      const backupCodes = user.backupCodes as string[];
      const usedCodes = (user.backupCodesUsed as number[]) || [];

      // Check if code exists and hasn't been used
      const codeIndex = backupCodes.indexOf(code.toUpperCase());

      if (codeIndex === -1 || usedCodes.includes(codeIndex)) {
        return {
          success: false,
          error: 'Invalid backup code.',
        };
      }

      // Mark backup code as used
      const updatedUsedCodes = [...usedCodes, codeIndex];
      await prisma.user.update({
        where: { id: userId },
        data: {
          backupCodesUsed: updatedUsedCodes,
        },
      });

      logger.info(`Backup code used for user ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      return {
        success: false,
        error: 'Failed to verify backup code.',
      };
    }
  }

  /**
   * Clean up expired OTP verifications
   */
  static async cleanupExpiredOTPs(): Promise<void> {
    try {
      const result = await prisma.oTPVerification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          isVerified: false,
        },
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired OTP verifications`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired OTPs:', error);
    }
  }
}

export default TwoFactorAuthService;
