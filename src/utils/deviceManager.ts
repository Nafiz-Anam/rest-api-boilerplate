import { Request } from 'express';
import type { Device, Session } from '@prisma/client';
import { prisma } from '../config/prisma';

// Device detection utilities
export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  platform?: string;
  browser?: string;
}

export interface SessionLimits {
  maxDevices: number;
  maxSessionsPerDevice: number;
}

// Default session limits
export const DEFAULT_SESSION_LIMITS: SessionLimits = {
  maxDevices: 3, // 1 mobile + 2 browsers as requested
  maxSessionsPerDevice: 1,
};

/**
 * Generate a unique device identifier based on user agent and other factors
 */
export function generateDeviceId(req: Request): string {
  const userAgent = req.get('User-Agent') || '';
  const acceptLanguage = req.get('Accept-Language') || '';

  // Create a hash from user agent and accept language for device identification
  const deviceString = `${userAgent}-${acceptLanguage}`;

  // Simple hash function (in production, use a proper crypto hash)
  let hash = 0;
  for (let i = 0; i < deviceString.length; i++) {
    const char = deviceString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Parse user agent to extract device information
 */
export function parseUserAgent(
  userAgent: string
): Omit<DeviceInfo, 'deviceId'> {
  const ua = userAgent.toLowerCase();

  // Device type detection
  let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/.test(ua)) {
    deviceType = 'mobile';
  } else if (/ipad|tablet|playbook|silk/.test(ua)) {
    deviceType = 'tablet';
  }

  // Platform detection
  let platform: string | undefined;
  if (/windows/.test(ua)) platform = 'Windows';
  else if (/macintosh|mac os x/.test(ua)) platform = 'macOS';
  else if (/linux/.test(ua)) platform = 'Linux';
  else if (/android/.test(ua)) platform = 'Android';
  else if (/ios|iphone|ipad|ipod/.test(ua)) platform = 'iOS';

  // Browser detection
  let browser: string | undefined;
  if (/chrome/.test(ua) && !/edge|edg/.test(ua)) browser = 'Chrome';
  else if (/firefox/.test(ua)) browser = 'Firefox';
  else if (/safari/.test(ua) && !/chrome/.test(ua)) browser = 'Safari';
  else if (/edge|edg/.test(ua)) browser = 'Edge';
  else if (/opera/.test(ua)) browser = 'Opera';

  // Generate device name
  const deviceName = `${browser || 'Unknown Browser'} on ${platform || 'Unknown Platform'}`;

  return {
    deviceName,
    deviceType,
    platform,
    browser,
  };
}

/**
 * Get device information from request
 */
export function getDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.get('User-Agent') || '';
  const parsedInfo = parseUserAgent(userAgent);
  const deviceId = generateDeviceId(req);

  return {
    deviceId,
    ...parsedInfo,
  };
}

/**
 * Check if user can create a new session
 */
export async function canCreateSession(
  userId: string,
  deviceInfo: DeviceInfo,
  limits: SessionLimits = DEFAULT_SESSION_LIMITS
): Promise<{
  canCreate: boolean;
  reason?: string;
  existingDevices?: Device[];
}> {
  // Get user's existing devices
  const existingDevices = await prisma.device.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      sessions: {
        where: {
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
      },
    },
  });

  // Check if device already exists
  const existingDevice = existingDevices.find(
    d => d.deviceId === deviceInfo.deviceId
  );

  if (existingDevice) {
    // Device exists, check session limit per device
    const activeSessions = existingDevice.sessions.length;
    if (activeSessions >= limits.maxSessionsPerDevice) {
      return {
        canCreate: false,
        reason: 'Maximum sessions per device exceeded',
        existingDevices,
      };
    }
    return { canCreate: true, existingDevices };
  }

  // New device, check total device limit
  const totalActiveDevices = existingDevices.length;
  if (totalActiveDevices >= limits.maxDevices) {
    return {
      canCreate: false,
      reason: 'Maximum devices exceeded',
      existingDevices,
    };
  }

  return { canCreate: true, existingDevices };
}

/**
 * Create or update device record
 */
export async function createOrUpdateDevice(
  userId: string,
  deviceInfo: DeviceInfo
): Promise<Device> {
  const existingDevice = await prisma.device.findUnique({
    where: {
      userId_deviceId: {
        userId,
        deviceId: deviceInfo.deviceId,
      },
    },
  });

  if (existingDevice) {
    // Update existing device
    return await prisma.device.update({
      where: { id: existingDevice.id },
      data: {
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
        browser: deviceInfo.browser,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });
  } else {
    // Create new device
    return await prisma.device.create({
      data: {
        userId,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
        browser: deviceInfo.browser,
      },
    });
  }
}

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  deviceInfo: DeviceInfo,
  accessToken: string,
  refreshToken: string,
  ipAddress?: string,
  userAgent?: string,
  expiresIn: string = '7d'
): Promise<Session> {
  // First, create or update the device
  const device = await createOrUpdateDevice(userId, deviceInfo);

  // Calculate expiration date
  const expiresAt = new Date();
  if (expiresIn.endsWith('d')) {
    const days = parseInt(expiresIn.slice(0, -1));
    expiresAt.setDate(expiresAt.getDate() + days);
  } else if (expiresIn.endsWith('h')) {
    const hours = parseInt(expiresIn.slice(0, -1));
    expiresAt.setHours(expiresAt.getHours() + hours);
  } else {
    // Default to 7 days
    expiresAt.setDate(expiresAt.getDate() + 7);
  }

  // Create session
  return await prisma.session.create({
    data: {
      userId,
      deviceId: device.id,
      token: accessToken,
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });
}

/**
 * Invalidate the oldest session when limit is exceeded
 */
export async function invalidateOldestSession(
  userId: string,
  deviceType?: 'mobile' | 'desktop' | 'tablet'
): Promise<void> {
  const whereClause: any = {
    userId,
    isActive: true,
    expiresAt: {
      gt: new Date(),
    },
  };

  if (deviceType) {
    whereClause.device = {
      deviceType,
    };
  }

  // Find the oldest session
  const oldestSession = await prisma.session.findFirst({
    where: whereClause,
    include: {
      device: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (oldestSession) {
    // Deactivate the oldest session
    await prisma.session.update({
      where: { id: oldestSession.id },
      data: { isActive: false },
    });

    // If no more active sessions for this device, deactivate the device
    const remainingSessions = await prisma.session.count({
      where: {
        deviceId: oldestSession.deviceId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (remainingSessions === 0) {
      await prisma.device.update({
        where: { id: oldestSession.deviceId },
        data: { isActive: false },
      });
    }
  }
}

/**
 * Get user's active devices with sessions
 */
export async function getUserDevices(
  userId: string
): Promise<(Device & { sessions: Session[] })[]> {
  const devices = await prisma.device.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      sessions: {
        where: {
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { lastUsedAt: 'desc' },
  });

  return devices as (Device & { sessions: Session[] })[];
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    return false;
  }

  // Deactivate the session
  await prisma.session.update({
    where: { id: sessionId },
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

  return true;
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  // Deactivate all sessions
  await prisma.session.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Deactivate all devices
  await prisma.device.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });
}

/**
 * Clean up expired sessions and inactive devices
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date();

  // Deactivate expired sessions
  await prisma.session.updateMany({
    where: {
      expiresAt: {
        lt: now,
      },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Find devices with no active sessions
  const devicesWithNoSessions = await prisma.device.findMany({
    where: {
      isActive: true,
      sessions: {
        none: {
          isActive: true,
          expiresAt: {
            gt: now,
          },
        },
      },
    },
  });

  // Deactivate those devices
  if (devicesWithNoSessions.length > 0) {
    await prisma.device.updateMany({
      where: {
        id: {
          in: devicesWithNoSessions.map(d => d.id),
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  }
}
