# Role-Based Authorization System Guide

This guide explains how to use the comprehensive role-based authorization system implemented in this REST API boilerplate.

## Overview

The authorization system includes:
- **Role Hierarchy**: USER → MODERATOR → ADMIN
- **Permission-Based Access Control**: Fine-grained permissions for specific actions
- **Resource Ownership**: Users can only access their own resources (unless they have elevated permissions)
- **Flexible Middleware**: Multiple middleware functions for different authorization scenarios

## Roles and Permissions

### Role Hierarchy
```
USER (Level 1)
├── Can create and manage own posts/comments
├── Can like/unlike posts
└── Can read and update own profile

MODERATOR (Level 2)
├── Inherits all USER permissions
├── Can manage any posts and comments
├── Can moderate content
└── Can read and resolve reports

ADMIN (Level 3)
├── Inherits all MODERATOR permissions
├── Can manage any user accounts
├── Can manage roles and permissions
├── Can access system logs and analytics
└── Full system administration
```

### Permission Categories

#### Profile Permissions
- `read:own_profile` - Read own user profile
- `update:own_profile` - Update own user profile
- `read:any_user` - Read any user profile
- `update:any_user` - Update any user profile
- `delete:any_user` - Delete any user account

#### Post Permissions
- `create:post` - Create new posts
- `read:own_post` - Read own posts (including drafts)
- `update:own_post` - Update own posts
- `delete:own_post` - Delete own posts
- `read:any_post` - Read any posts (including drafts)
- `update:any_post` - Update any posts
- `delete:any_post` - Delete any posts
- `create:admin_post` - Create administrative posts

#### Comment Permissions
- `create:comment` - Create comments
- `read:own_comment` - Read own comments
- `update:own_comment` - Update own comments
- `delete:own_comment` - Delete own comments
- `read:any_comment` - Read any comments
- `update:any_comment` - Update any comments
- `delete:any_comment` - Delete any comments

#### Moderation Permissions
- `moderate:content` - Moderate any content
- `read:reports` - Read content reports
- `resolve:reports` - Resolve content reports

#### Administrative Permissions
- `manage:roles` - Manage user roles
- `read:system_logs` - Read system activity logs
- `manage:system_settings` - Manage system settings
- `read:analytics` - Read system analytics
- `manage:oauth` - Manage OAuth configurations

#### Interaction Permissions
- `like:post` - Like posts
- `unlike:post` - Unlike posts

## Usage Examples

### 1. Basic Permission Check

```typescript
import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

// Only users with 'create:post' permission can create posts
router.post('/posts',
  authenticateToken,
  requirePermission('create:post'),
  async (req, res) => {
    // Create post logic
  }
);
```

### 2. Role-Based Access

```typescript
import { requireRole, requireMinimumRole } from '../middleware/auth';
import { Role } from '../config/role';

// Only admins can access this route
router.get('/admin/dashboard',
  authenticateToken,
  requireRole(Role.ADMIN),
  async (req, res) => {
    // Admin dashboard logic
  }
);

// Moderators and admins can access this route
router.get('/moderation/queue',
  authenticateToken,
  requireMinimumRole(Role.MODERATOR),
  async (req, res) => {
    // Moderation logic
  }
);
```

### 3. Multiple Permission Requirements

```typescript
import { requireAnyPermission, requireAllPermissions } from '../middleware/auth';

// User needs ANY of these permissions
router.put('/posts/:id',
  authenticateToken,
  requireAnyPermission(['update:own_post', 'update:any_post']),
  async (req, res) => {
    // Update post logic
  }
);

// User needs ALL of these permissions
router.post('/admin/system',
  authenticateToken,
  requireAllPermissions(['manage:system_settings', 'read:analytics']),
  async (req, res) => {
    // System management logic
  }
);
```

### 4. Resource Ownership Verification

```typescript
import { verifyResourceOwnership } from '../middleware/auth';

// User can only update their own post (unless they have elevated permissions)
router.put('/posts/:id',
  authenticateToken,
  requireAnyPermission(['update:own_post', 'update:any_post']),
  verifyResourceOwnership('id', 'post'),
  async (req, res) => {
    // Update post logic
  }
);

// User can only delete their own comment
router.delete('/comments/:id',
  authenticateToken,
  requirePermission('delete:own_comment'),
  verifyResourceOwnership('id', 'comment'),
  async (req, res) => {
    // Delete comment logic
  }
);
```

### 5. Advanced Role Management

```typescript
import { hasPermission, canManageRole, getAssignableRoles } from '../config/role';

// Check permissions programmatically
router.put('/users/:id/role',
  authenticateToken,
  async (req, res) => {
    const { role } = req.body;
    const targetUserId = req.params.id;
    
    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true }
    });
    
    // Check if current user can manage this role change
    if (!canManageRole(req.user.role, targetUser.role) || 
        !canManageRole(req.user.role, role)) {
      return res.status(403).json({
        error: 'Insufficient privileges to manage this role'
      });
    }
    
    // Update role logic
  }
);

// Get assignable roles for current user
router.get('/roles/assignable',
  authenticateToken,
  requirePermission('manage:roles'),
  async (req, res) => {
    const assignableRoles = getAssignableRoles(req.user.role);
    res.json({ assignableRoles });
  }
);
```

## Middleware Functions

### Authentication Middleware
- `authenticateToken` - Validates JWT token and sets `req.user`
- `optionalAuth` - Optional authentication (doesn't fail if no token)

### Authorization Middleware
- `requirePermission(permission)` - Requires specific permission
- `requireAnyPermission(permissions[])` - Requires any of the specified permissions
- `requireAllPermissions(permissions[])` - Requires all of the specified permissions
- `requireRole(role | roles[])` - Requires specific role(s)
- `requireMinimumRole(role)` - Requires minimum role level or higher

### Resource Ownership Middleware
- `verifyResourceOwnership(resourceIdParam, resourceType)` - Verifies user owns the resource or has elevated permissions

## Helper Functions

### Permission Checks
```typescript
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../config/role';

// Check single permission
if (hasPermission(user.role, 'create:post')) {
  // User can create posts
}

// Check any permission
if (hasAnyPermission(user.role, ['update:own_post', 'update:any_post'])) {
  // User can update posts
}

// Check all permissions
if (hasAllPermissions(user.role, ['read:analytics', 'manage:system_settings'])) {
  // User has all required permissions
}
```

### Role Management
```typescript
import { 
  hasEqualOrHigherRole, 
  canManageRole, 
  getMinimumRoleForPermission,
  getAssignableRoles 
} from '../config/role';

// Check role hierarchy
if (hasEqualOrHigherRole(user.role, Role.MODERATOR)) {
  // User is moderator or admin
}

// Check role management
if (canManageRole(adminRole, targetRole)) {
  // Admin can manage target role
}

// Get minimum role for permission
const minRole = getMinimumRoleForPermission('delete:any_user'); // Returns Role.ADMIN

// Get assignable roles
const assignable = getAssignableRoles(user.role);
```

## Configuration

### Role Configuration (`src/config/role.ts`)

The role configuration is centralized in `src/config/role.ts`:

```typescript
export const ROLE_HIERARCHY = {
  [Role.USER]: 1,
  [Role.MODERATOR]: 2,
  [Role.ADMIN]: 3,
} as const

export const ROLE_PERMISSIONS = {
  [Role.USER]: [
    'read:own_profile',
    'update:own_profile',
    'create:post',
    // ... more permissions
  ],
  [Role.MODERATOR]: [
    // Inherits USER permissions + moderator-specific permissions
    'read:any_post',
    'update:any_post',
    // ... more permissions
  ],
  [Role.ADMIN]: [
    // Inherits MODERATOR permissions + admin-specific permissions
    'manage:roles',
    'read:system_logs',
    // ... more permissions
  ],
} as const
```

### Adding New Permissions

1. Add the permission to the appropriate role(s) in `ROLE_PERMISSIONS`
2. Use the permission in your routes with `requirePermission()`
3. Optionally add it to `PERMISSION_CATEGORIES` for better organization

### Adding New Roles

1. Add the role to the `Role` enum in both `src/config/role.ts` and `prisma/schema.prisma`
2. Update `ROLE_HIERARCHY` with the new role's level
3. Define permissions for the new role in `ROLE_PERMISSIONS`
4. Update any helper functions that reference specific roles

## Error Responses

The authorization middleware returns consistent error responses:

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS",
  "required": "create:post",
  "current": "USER"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found",
  "code": "RESOURCE_NOT_FOUND"
}
```

## Best Practices

1. **Principle of Least Privilege**: Only grant necessary permissions
2. **Resource Ownership**: Always verify ownership for user-specific resources
3. **Permission-Based over Role-Based**: Prefer specific permissions over generic roles
4. **Consistent Error Handling**: Use the provided error response format
5. **Audit Logging**: Log important actions, especially role changes and admin actions
6. **Validation**: Always validate input data before processing
7. **Rate Limiting**: Implement rate limiting for sensitive operations

## Testing

When testing authorization:

1. **Test Each Role**: Verify each role has exactly the expected permissions
2. **Test Edge Cases**: Test resource ownership, role boundaries, and permission inheritance
3. **Test Error Cases**: Verify proper error responses for unauthorized access
4. **Integration Tests**: Test complete workflows with different user roles

## Migration from Existing System

If migrating from the old role-based system:

1. Update imports to use new middleware functions
2. Replace role string checks with permission-based checks
3. Update database queries to use the new Role enum
4. Test all existing endpoints with different user roles
5. Update any custom authorization logic to use the new helper functions

This comprehensive authorization system provides a secure, flexible, and maintainable way to manage user permissions in your REST API.
