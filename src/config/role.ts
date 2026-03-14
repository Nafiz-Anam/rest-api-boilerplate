// Import Role enum from Prisma schema - single source of truth
import { Role } from '@prisma/client';

// Role hierarchy - higher number means more privileges
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.USER]: 1,
  [Role.MODERATOR]: 2,
  [Role.ADMIN]: 3,
} as const;

// Permission levels for granular access control
export const PERMISSION_LEVELS = {
  // User permissions (level 1)
  USER: {
    canReadOwnProfile: true,
    canUpdateOwnProfile: true,
    canCreatePost: true,
    canReadOwnPost: true,
    canUpdateOwnPost: true,
    canDeleteOwnPost: true,
    canCreateComment: true,
    canReadOwnComment: true,
    canUpdateOwnComment: true,
    canDeleteOwnComment: true,
    canLikePost: true,
    canUnlikePost: true,
  },

  // Moderator permissions (level 2) - includes all user permissions
  MODERATOR: {
    canReadOwnProfile: true,
    canUpdateOwnProfile: true,
    canCreatePost: true,
    canReadOwnPost: true,
    canUpdateOwnPost: true,
    canDeleteOwnPost: true,
    canCreateComment: true,
    canReadOwnComment: true,
    canUpdateOwnComment: true,
    canDeleteOwnComment: true,
    canLikePost: true,
    canUnlikePost: true,
    canReadAnyPost: true,
    canUpdateAnyPost: true,
    canDeleteAnyPost: true,
    canManageComments: true,
    canModerateContent: true,
    canViewAnalytics: true,
  },

  // Admin permissions (level 3) - includes all permissions
  ADMIN: {
    canReadOwnProfile: true,
    canUpdateOwnProfile: true,
    canCreatePost: true,
    canReadOwnPost: true,
    canUpdateOwnPost: true,
    canDeleteOwnPost: true,
    canCreateComment: true,
    canReadOwnComment: true,
    canUpdateOwnComment: true,
    canDeleteOwnComment: true,
    canLikePost: true,
    canUnlikePost: true,
    canReadAnyPost: true,
    canUpdateAnyPost: true,
    canDeleteAnyPost: true,
    canManageComments: true,
    canModerateContent: true,
    canViewAnalytics: true,
    canManageUsers: true,
    canManageRoles: true,
    canAccessSystem: true,
    canViewSystemLogs: true,
    canManageSystem: true,
  },
} as const;

// Permission checking utilities
export const hasRole = (userRole: Role, requiredRole: Role): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

// Role guards for middleware
export const requireRole =
  (requiredRole: Role) =>
  (userRole: Role): boolean => {
    return hasRole(userRole, requiredRole);
  };

// Export Role enum from Prisma for convenience
export { Role };

// Type helpers
export type UserRole = Role;
export type PermissionLevel = keyof typeof PERMISSION_LEVELS.ADMIN;
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  [Role.USER]: Object.keys(PERMISSION_LEVELS.USER).filter(
    key =>
      PERMISSION_LEVELS.USER[key as keyof typeof PERMISSION_LEVELS.USER] ===
      true
  ),
  [Role.MODERATOR]: [
    // Inherits all USER permissions
    ...Object.keys(PERMISSION_LEVELS.USER).filter(
      key =>
        PERMISSION_LEVELS.USER[key as keyof typeof PERMISSION_LEVELS.USER] ===
        true
    ),
    // Additional moderator permissions
    'read:any_post',
    'update:any_post',
    'delete:any_post',
    'read:any_comment',
    'update:any_comment',
    'delete:any_comment',
    'moderate:content',
    'read:reports',
    'resolve:reports',
  ],
  [Role.ADMIN]: [
    // Inherits all MODERATOR permissions
    ...Object.keys(PERMISSION_LEVELS.USER).filter(
      key =>
        PERMISSION_LEVELS.USER[key as keyof typeof PERMISSION_LEVELS.USER] ===
        true
    ),
    'read:any_post',
    'update:any_post',
    'delete:any_post',
    'read:any_comment',
    'update:any_comment',
    'delete:any_comment',
    'moderate:content',
    'read:reports',
    'resolve:reports',
    // Additional admin permissions
    'manage:roles',
    'read:system_logs',
    'manage:users',
    'manage:system',
  ],
} as const;

// Permission categories for better organization
export const PERMISSION_CATEGORIES = {
  PROFILE: [
    'read:own_profile',
    'update:own_profile',
    'read:any_user',
    'update:any_user',
    'delete:any_user',
  ],
  POST: [
    'create:post',
    'read:own_post',
    'update:own_post',
    'delete:own_post',
    'read:any_post',
    'update:any_post',
    'delete:any_post',
    'create:admin_post',
  ],
  COMMENT: [
    'create:comment',
    'read:own_comment',
    'update:own_comment',
    'delete:own_comment',
    'read:any_comment',
    'update:any_comment',
    'delete:any_comment',
  ],
  MODERATION: ['moderate:content', 'read:reports', 'resolve:reports'],
  ADMIN: [
    'manage:roles',
    'read:system_logs',
    'manage:system_settings',
    'read:analytics',
    'manage:oauth',
  ],
  INTERACTION: ['like:post', 'unlike:post'],
} as const;

// Helper functions for role-based authorization

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role: Role, permission: string): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
};

/**
 * Check if a role has any of the specified permissions
 */
export const hasAnyPermission = (
  role: Role,
  permissions: string[]
): boolean => {
  return permissions.some(permission => hasPermission(role, permission));
};

/**
 * Check if a role has all of the specified permissions
 */
export const hasAllPermissions = (
  role: Role,
  permissions: string[]
): boolean => {
  return permissions.every(permission => hasPermission(role, permission));
};

/**
 * Check if a user can access a resource based on ownership and role
 */
export const canAccessResource = (
  userRole: Role,
  userId: string,
  resourceOwnerId: string,
  requiredPermission?: string
): boolean => {
  // Admin can access any resource
  if (userRole === 'ADMIN') {
    return true;
  }

  // Moderator can access any resource if they have the required permission
  if (userRole === 'MODERATOR' && requiredPermission) {
    return hasPermission(userRole, requiredPermission);
  }

  // Users can only access their own resources
  return userId === resourceOwnerId;
};

/**
 * Get the minimum role required for a permission
 */
export const getMinimumRoleForPermission = (
  permission: string
): Role | null => {
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    if (permissions.includes(permission)) {
      return role as Role;
    }
  }
  return null;
};

/**
 * Check if a role has higher or equal privilege level compared to another role
 */
export const hasEqualOrHigherRole = (
  userRole: Role,
  requiredRole: Role
): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/**
 * Check if a role can manage another role
 */
export const canManageRole = (managerRole: Role, targetRole: Role): boolean => {
  // Admin can manage any role except themselves (in some contexts)
  if (managerRole === 'ADMIN') {
    return true;
  }

  // Moderator can only manage USER roles
  if (managerRole === 'MODERATOR') {
    return targetRole === 'USER';
  }

  // USER cannot manage any roles
  return false;
};

/**
 * Get all permissions for a role (including inherited permissions)
 */
export const getRolePermissions = (role: Role): readonly string[] => {
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Get roles that can be assigned by a specific role
 */
export const getAssignableRoles = (assignerRole: Role): Role[] => {
  const allRoles = Object.values(Role) as Role[];

  if (assignerRole === 'ADMIN') {
    return allRoles;
  }

  if (assignerRole === 'MODERATOR') {
    return ['USER'] as Role[];
  }

  return []; // USER cannot assign roles
};

/**
 * Validate role transition
 */
export const isValidRoleTransition = (
  currentRole: Role,
  newRole: Role,
  performerRole: Role
): boolean => {
  // Only ADMIN can change roles
  if (performerRole !== 'ADMIN') {
    return false;
  }

  // Admin can change any role to any role
  return true;
};

// Export types for better TypeScript support
export type Permission = (typeof ROLE_PERMISSIONS)[Role][number];
export type RoleWithPermissions = Role & { permissions: string[] };

// Default export for convenience
export default {
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  PERMISSION_CATEGORIES,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessResource,
  getMinimumRoleForPermission,
  hasEqualOrHigherRole,
  canManageRole,
  getRolePermissions,
  getAssignableRoles,
  isValidRoleTransition,
};
