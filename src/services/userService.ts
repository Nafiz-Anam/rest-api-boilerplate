import { prisma } from '../config/prisma';
import { Role, hasRole, hasPermission } from '../config/role';
import * as bcryptjs from 'bcryptjs';
import logger from '../config/logger';

// User management service with optimized database operations
export class UserService {
  // Get user with minimal fields - optimized query
  static async getUserById(id: string, includeProfile = false) {
    return prisma.user.findUnique({
      where: { id },
      select: includeProfile
        ? {
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
          }
        : {
            id: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
          },
    });
  }

  // Get user by email with session - optimized single query
  static async getUserByEmailWithSession(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        sessions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  // Create user with session - transaction for consistency
  static async createUserWithSession(userData: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
    deviceInfo?: {
      deviceId: string;
      ipAddress: string;
      userAgent: string;
    };
  }) {
    return prisma.$transaction(async tx => {
      // Hash password
      const hashedPassword = await bcryptjs.hash(userData.password, 10);

      // Create user
      const user = await tx.user.create({
        data: {
          email: userData.email,
          username: userData.username,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: Role.USER,
        },
      });

      // Create session if device info provided
      if (userData.deviceInfo) {
        await tx.session.create({
          data: {
            userId: user.id,
            deviceId: userData.deviceInfo.deviceId,
            token: `session-${Date.now()}-${Math.random().toString(36).substring(2)}`,
            refreshToken: `refresh-${Date.now()}-${Math.random().toString(36).substring(2)}`,
            ipAddress: userData.deviceInfo.ipAddress,
            userAgent: userData.deviceInfo.userAgent,
            isActive: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      logger.info(`User created: ${userData.email}`, {
        userId: user.id,
        type: 'user_created',
      });

      return user;
    });
  }

  // Update user with validation and permissions
  static async updateUser(
    id: string,
    updateData: {
      email?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      avatar?: string;
      role?: Role;
      isActive?: boolean;
    },
    requestingUserId?: string
  ) {
    return prisma.$transaction(async tx => {
      // Check if user exists
      const existingUser = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      // Check permissions for role changes
      if (updateData.role && requestingUserId) {
        const requestingUser = await tx.user.findUnique({
          where: { id: requestingUserId },
          select: { role: true },
        });

        if (!requestingUser || !hasRole(requestingUser.role, Role.ADMIN)) {
          throw new Error('Insufficient permissions to change roles');
        }
      }

      // Update user
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
      });

      logger.info(`User updated: ${id}`, {
        updates: Object.keys(updateData),
        type: 'user_updated',
      });

      return updatedUser;
    });
  }

  // Delete user with cascade and permissions
  static async deleteUser(id: string, requestingUserId?: string) {
    return prisma.$transaction(async tx => {
      // Check permissions
      if (requestingUserId) {
        const requestingUser = await tx.user.findUnique({
          where: { id: requestingUserId },
          select: { role: true },
        });

        if (!requestingUser || !hasRole(requestingUser.role, Role.ADMIN)) {
          throw new Error('Insufficient permissions to delete users');
        }
      }

      // Delete user (cascade will handle related records)
      await tx.user.delete({
        where: { id },
      });

      logger.info(`User deleted: ${id}`, {
        type: 'user_deleted',
      });
    });
  }

  // Resource ownership verification - generic and optimized
  static async verifyResourceOwnership(
    userId: string,
    resourceId: string,
    resourceModel: keyof typeof prisma,
    ownerField: string = 'authorId'
  ): Promise<boolean> {
    try {
      const resource = await (prisma[resourceModel] as any).findUnique({
        where: { id: resourceId },
        select: { [ownerField]: true },
      });

      return resource ? resource[ownerField] === userId : false;
    } catch (error) {
      logger.error('Resource ownership verification failed:', {
        userId,
        resourceId,
        resourceModel,
        error: error.message,
      });
      return false;
    }
  }

  // Session management - optimized
  static async createSession(sessionData: {
    userId: string;
    deviceId: string;
    ipAddress: string;
    userAgent: string;
    expiresAt?: Date;
  }) {
    return prisma.session.create({
      data: {
        userId: sessionData.userId,
        deviceId: sessionData.deviceId,
        token: `session-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        refreshToken: `refresh-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        isActive: true,
        expiresAt:
          sessionData.expiresAt ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  static async invalidateUserSessions(userId: string) {
    return prisma.session.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
        expiresAt: new Date(),
      },
    });
  }

  static async invalidateSession(sessionId: string) {
    return prisma.session.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        expiresAt: new Date(),
      },
    });
  }

  // Device management - optimized
  static async getUserDevices(userId: string) {
    return prisma.device.findMany({
      where: {
        sessions: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
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
    });
  }

  // Permission checking utilities
  static canUserAccessResource(
    userRole: Role,
    resourceOwnerId: string,
    userId: string
  ): boolean {
    // Admin can access any resource
    if (hasRole(userRole, Role.ADMIN)) {
      return true;
    }

    // Moderator can access any resource if they have moderate permission
    if (
      hasRole(userRole, Role.MODERATOR) &&
      hasPermission(userRole, 'moderate:content')
    ) {
      return true;
    }

    // User can only access their own resources
    return resourceOwnerId === userId;
  }

  // User search with pagination and filtering
  static async searchUsers(query: {
    search?: string;
    role?: Role;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { username: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}
