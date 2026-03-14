import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  Role,
} from '../config/role';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: Role;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  body: any;
  params: any;
  query: any;
  headers: any;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'TOKEN_MISSING',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Verify session exists and is active
    const session = await prisma.session.findFirst({
      where: {
        token,
        userId: decoded.userId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        device: {
          select: {
            deviceName: true,
            deviceType: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(401).json({
        error: 'Invalid or expired session',
        code: 'SESSION_INVALID',
      });
    }

    // Update device last used time
    await prisma.device.update({
      where: { id: session.deviceId },
      data: { lastUsedAt: new Date() },
    });

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid or inactive user',
        code: 'USER_INVALID',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      avatar: user.avatar || undefined,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Attach session info for device management
    (req as any).session = {
      id: session.id,
      device: session.device,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID',
      });
    }

    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        avatar: user.avatar || undefined,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }
  } catch (error) {
    // Ignore errors for optional auth
  }

  next();
};

// Resource owner verification
export const verifyResourceOwner = (resourceIdParam: string = 'id') => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const resourceId = req.params[resourceIdParam];

    // Admin can access any resource
    if (req.user.role === 'ADMIN') {
      return next();
    }

    try {
      // Check if user owns the resource (example for posts)
      const resource = await prisma.post.findUnique({
        where: { id: resourceId },
        select: { authorId: true },
      });

      if (!resource) {
        return res.status(404).json({
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      if (resource.authorId !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied: not the resource owner',
          code: 'NOT_RESOURCE_OWNER',
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Error verifying resource ownership',
        code: 'VERIFICATION_ERROR',
      });
    }
  };
};

// Enhanced authorization middleware using the role configuration
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
        current: req.user.role,
      });
    }

    next();
  };
};

// Middleware to require any of the specified permissions
export const requireAnyPermission = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!hasAnyPermission(req.user.role, permissions)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        current: req.user.role,
      });
    }

    next();
  };
};

// Middleware to require all of the specified permissions
export const requireAllPermissions = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!hasAllPermissions(req.user.role, permissions)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        current: req.user.role,
      });
    }

    next();
  };
};

// Enhanced resource owner verification with role-based access
export const verifyResourceOwnership = (
  resourceIdParam: string = 'id',
  resourceType: string = 'resource'
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const resourceId = req.params[resourceIdParam];

    // Admin can access any resource
    if (req.user.role === Role.ADMIN) {
      return next();
    }

    // Moderator can access any resource if they have moderate permission
    if (
      req.user.role === Role.MODERATOR &&
      hasPermission(req.user.role, 'moderate:content')
    ) {
      return next();
    }

    try {
      let resource;

      // Check different resource types based on the parameter
      switch (resourceType) {
        case 'post':
          resource = await prisma.post.findUnique({
            where: { id: resourceId },
            select: { authorId: true },
          });
          break;
        case 'comment':
          resource = await prisma.comment.findUnique({
            where: { id: resourceId },
            select: { authorId: true },
          });
          break;
        case 'user':
          resource = await prisma.user.findUnique({
            where: { id: resourceId },
            select: { id: true },
          });
          break;
        default:
          return res.status(400).json({
            error: 'Invalid resource type',
            code: 'INVALID_RESOURCE_TYPE',
          });
      }

      if (!resource) {
        return res.status(404).json({
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      const ownerId = resourceType === 'user' ? resource.id : resource.authorId;

      if (ownerId !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied: not the resource owner',
          code: 'NOT_RESOURCE_OWNER',
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Error verifying resource ownership',
        code: 'VERIFICATION_ERROR',
      });
    }
  };
};

// Role-based access control middleware
export const requireRole = (roles: Role | Role[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient role privileges',
        code: 'INSUFFICIENT_ROLE',
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
};

// Minimum role requirement middleware
export const requireMinimumRole = (minimumRole: Role) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const roleHierarchy = {
      [Role.USER]: 1,
      [Role.MODERATOR]: 2,
      [Role.ADMIN]: 3,
    };

    if (roleHierarchy[req.user.role] < roleHierarchy[minimumRole]) {
      return res.status(403).json({
        error: 'Insufficient role privileges',
        code: 'INSUFFICIENT_ROLE',
        required: minimumRole,
        current: req.user.role,
      });
    }

    next();
  };
};
