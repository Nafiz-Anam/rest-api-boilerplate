# Device Management & Session Control Guide

This guide explains the comprehensive device management and session control system implemented in your REST API boilerplate.

## Overview

The device management system provides:
- **Multi-Device Support**: Users can log in from multiple devices with intelligent limits
- **Session Control**: Granular control over active sessions per device
- **Device Recognition**: Automatic device detection and fingerprinting
- **Security Features**: Automatic cleanup of expired sessions and devices
- **User Management**: Users can view and manage their active devices

## Session Limits Configuration

### Default Limits
```typescript
const DEFAULT_SESSION_LIMITS = {
  maxDevices: 3,        // Maximum total devices per user
  maxSessionsPerDevice: 1  // Maximum sessions per device
};
```

### Device Type Limits
- **Mobile**: 1 device maximum
- **Desktop**: 2 devices maximum  
- **Tablet**: Counted towards total device limit

**Example**: A user can have:
- 1 mobile device (iPhone/Android)
- 2 desktop devices (Chrome on Windows, Safari on macOS)
- Total: 3 devices

## Device Detection System

### Device Fingerprinting
The system generates unique device identifiers using:
- User Agent string
- Accept-Language header
- Browser characteristics
- Platform information

### Device Information Extracted
```typescript
interface DeviceInfo {
  deviceId: string;           // Unique device identifier
  deviceName: string;         // Human-readable name (e.g., "Chrome on Windows")
  deviceType: 'mobile' | 'desktop' | 'tablet';
  platform?: string;         // iOS, Android, Windows, macOS, Linux
  browser?: string;          // Chrome, Safari, Firefox, Edge, Opera
}
```

## Database Schema

### Device Model
```sql
CREATE TABLE devices (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  deviceId    TEXT UNIQUE NOT NULL,    -- Device fingerprint
  deviceName  TEXT NOT NULL,          -- "Chrome on Windows"
  deviceType  TEXT NOT NULL,          -- 'mobile', 'desktop', 'tablet'
  platform    TEXT,                   -- 'iOS', 'Android', 'Windows', etc.
  browser     TEXT,                   -- 'Chrome', 'Safari', etc.
  isActive    BOOLEAN DEFAULT true,
  lastUsedAt  DATETIME DEFAULT now(),
  createdAt   DATETIME DEFAULT now(),
  updatedAt   DATETIME,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(userId, deviceId)
);
```

### Session Model
```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  deviceId    TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL,     -- JWT access token
  refreshToken TEXT UNIQUE NOT NULL,  -- JWT refresh token
  expiresAt   DATETIME NOT NULL,
  ipAddress   TEXT,
  userAgent   TEXT,
  isActive    BOOLEAN DEFAULT true,
  createdAt   DATETIME DEFAULT now(),
  updatedAt   DATETIME,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
);
```

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login
Enhanced login with device management:

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "username": "john_doe",
      "role": "USER"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token",
      "expiresIn": "7d"
    },
    "device": {
      "deviceName": "Chrome on Windows",
      "deviceType": "desktop"
    }
  }
}
```

**Device Limit Exceeded Response:**
```json
{
  "success": false,
  "error": "Maximum device limit exceeded",
  "code": "DEVICE_LIMIT_EXCEEDED",
  "data": {
    "currentDevices": [
      {
        "deviceName": "Safari on iPhone",
        "deviceType": "mobile",
        "lastUsedAt": "2024-01-15T10:30:00Z"
      },
      {
        "deviceName": "Chrome on Windows",
        "deviceType": "desktop", 
        "lastUsedAt": "2024-01-15T09:15:00Z"
      }
    ]
  }
}
```

#### POST /api/auth/logout
Enhanced logout with session-specific termination:

**Request:**
```bash
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### Device Management Endpoints

#### GET /api/devices
Get user's active devices and sessions:

**Response:**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": "device_id",
        "deviceId": "fingerprint_hash",
        "deviceName": "Chrome on Windows",
        "deviceType": "desktop",
        "platform": "Windows",
        "browser": "Chrome",
        "isActive": true,
        "lastUsedAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-10T08:00:00Z",
        "sessions": [
          {
            "id": "session_id",
            "isActive": true,
            "createdAt": "2024-01-15T08:00:00Z",
            "expiresAt": "2024-01-22T08:00:00Z",
            "ipAddress": "192.168.1.100",
            "userAgent": "Mozilla/5.0..."
          }
        ]
      }
    ]
  }
}
```

#### DELETE /api/devices/sessions/:sessionId
Revoke a specific session:

**Response:**
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

#### DELETE /api/devices/sessions
Revoke all sessions (logout from all devices):

**Response:**
```json
{
  "success": true,
  "message": "All sessions revoked successfully"
}
```

#### DELETE /api/devices/:deviceId
Deactivate a specific device and all its sessions:

**Response:**
```json
{
  "success": true,
  "message": "Device deactivated successfully"
}
```

#### GET /api/devices/stats
Get session and device statistics:

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "devices": {
        "total": 5,
        "active": 3,
        "mobile": 1,
        "desktop": 2,
        "tablet": 0
      },
      "sessions": {
        "total": 8,
        "active": 3
      }
    }
  }
}
```

## Usage Examples

### Frontend Integration

#### Login with Device Management
```javascript
const handleLogin = async (email, password) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Store tokens
      localStorage.setItem('accessToken', data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
      
      // Show device info to user
      console.log(`Logged in from: ${data.data.device.deviceName}`);
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else if (data.code === 'DEVICE_LIMIT_EXCEEDED') {
      // Show device management modal
      showDeviceLimitModal(data.data.currentDevices);
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

#### Device Management UI
```javascript
const loadDevices = async () => {
  const response = await fetch('/api/devices', {
    headers: { 
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    renderDeviceList(data.data.devices);
  }
};

const revokeSession = async (sessionId) => {
  const response = await fetch(`/api/devices/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    }
  });
  
  if (response.ok) {
    // Refresh device list
    loadDevices();
    showNotification('Session revoked successfully');
  }
};

const revokeAllSessions = async () => {
  if (confirm('Are you sure you want to logout from all devices?')) {
    const response = await fetch('/api/devices/sessions', {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    
    if (response.ok) {
      // Clear local storage and redirect to login
      localStorage.clear();
      window.location.href = '/login';
    }
  }
};
```

## Security Features

### Session Validation
- Every API request validates the session exists and is active
- Automatic session timeout based on expiration
- Device fingerprinting prevents session hijacking

### Automatic Cleanup
```typescript
// Run cleanup periodically (e.g., daily cron job)
await cleanupExpiredSessions();
```

### Rate Limiting
- Device limit enforcement prevents abuse
- Session limit per device prevents session flooding
- Automatic oldest session termination when limits exceeded

## Configuration Options

### Custom Session Limits
```typescript
// In deviceManager.ts
export const CUSTOM_SESSION_LIMITS: SessionLimits = {
  maxDevices: 5,              // Increase for premium users
  maxSessionsPerDevice: 2     // Allow multiple browser tabs
};
```

### Device Type Detection
```typescript
// Add custom device detection rules
function parseUserAgent(userAgent: string): DeviceInfo {
  // Custom detection logic here
  // Override default detection if needed
}
```

## Best Practices

### For Developers
1. **Always validate sessions** - Use the provided authentication middleware
2. **Handle device limits gracefully** - Show user-friendly error messages
3. **Implement device management UI** - Allow users to manage their sessions
4. **Log security events** - Track device changes and session revocations
5. **Use HTTPS** - Essential for secure token transmission

### For Users
1. **Monitor active devices** - Regularly check for unknown devices
2. **Revoke suspicious sessions** - Immediately revoke unrecognized sessions
3. **Use strong passwords** - Prevent unauthorized access
4. **Enable 2FA when available** - Additional security layer

### For Administrators
1. **Monitor session patterns** - Look for unusual login patterns
2. **Set appropriate limits** - Balance security and user experience
3. **Regular cleanup** - Schedule expired session cleanup
4. **Audit device access** - Review device access logs regularly

## Troubleshooting

### Common Issues

#### "Device Limit Exceeded" Error
**Cause**: User has reached maximum device limit
**Solution**: 
1. Revoke an old session from device management
2. Wait for automatic session expiration
3. Contact admin to increase limits

#### "Session Invalid" Error  
**Cause**: Session expired or was revoked
**Solution**: 
1. User must login again
2. Check if user intentionally logged out from other devices

#### Device Not Recognized
**Cause**: Browser or OS update changed fingerprint
**Solution**: 
1. User treats as new device login
2. May need to revoke old device session

### Debug Information

Enable debug logging to troubleshoot device detection:
```typescript
// In deviceManager.ts
console.log('Device Info:', getDeviceInfo(req));
console.log('Session Check:', await canCreateSession(userId, deviceInfo));
```

## Migration Guide

### From Basic JWT to Device Management

1. **Update Database Schema**:
   ```sql
   -- Run Prisma migration
   npx prisma migrate dev --name add_device_management
   ```

2. **Update Authentication**:
   ```typescript
   // Replace basic JWT validation
   // With session-based validation
   import { authenticateToken } from '../middleware/auth';
   ```

3. **Update Login Logic**:
   ```typescript
   // Replace token storage
   // With device and session creation
   import { createSession } from '../utils/deviceManager';
   ```

4. **Add Device Management UI**:
   - Create device list component
   - Add session revocation functionality
   - Show device statistics

This comprehensive device management system provides enterprise-grade session control while maintaining excellent user experience.
