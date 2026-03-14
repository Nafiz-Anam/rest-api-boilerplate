# Passport.js JWT Authentication Migration

This document outlines the migration from custom JWT authentication to Passport.js with enhanced security features.

## Overview

The authentication system has been migrated from a custom JWT implementation to Passport.js with the following enhancements:

### New Features Added

1. **Passport.js Integration**
   - JWT strategy for token-based authentication
   - Local strategy for username/password authentication
   - Google OAuth 2.0 strategy
   - GitHub OAuth strategy

2. **Enhanced Security**
   - Refresh token rotation system
   - Session management with Redis
   - Social authentication support
   - Improved token validation

3. **Database Schema Updates**
   - Added `googleId` and `githubId` fields to User model
   - Added `RefreshToken` model for token management
   - Maintained backward compatibility

## API Endpoints

### Authentication Routes (`/api/auth`)

#### Local Authentication
- `POST /register` - User registration with email validation
- `POST /login` - Username/password login
- `POST /refresh` - Refresh access token using refresh token
- `POST /logout` - Logout and invalidate refresh token
- `GET /profile` - Get current user profile

#### Social Authentication
- `GET /google` - Initiate Google OAuth flow
- `GET /google/callback` - Google OAuth callback
- `GET /github` - Initiate GitHub OAuth flow
- `GET /github/callback` - GitHub OAuth callback

#### Admin Routes
- `GET /admin/users` - Admin-only user listing (example of role-based access)

## Token Management

### Access Tokens
- Short-lived tokens (configurable via `JWT_EXPIRES_IN`)
- Used for API authentication
- Bearer token format: `Authorization: Bearer <token>`

### Refresh Tokens
- Long-lived tokens (configurable via `JWT_REFRESH_EXPIRES_IN`)
- Used to generate new access tokens
- Stored in database with expiration
- Revoked on logout

## Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="your-refresh-token-secret-here"
JWT_REFRESH_EXPIRES_IN="30d"

# Session Management
SESSION_SECRET="your-session-secret-here"
REDIS_URL="redis://localhost:6379"

# Social Authentication
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"

GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GITHUB_CALLBACK_URL="http://localhost:3000/api/auth/github/callback"
```

## Usage Examples

### Local Login
```javascript
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "role": "USER"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token",
      "expiresIn": "7d"
    }
  }
}
```

### Token Refresh
```javascript
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt_refresh_token"
}
```

### Social Authentication (Google)
1. Redirect user to: `GET /api/auth/google`
2. User authenticates with Google
3. Google redirects to: `/api/auth/google/callback?code=xxx`
4. Server exchanges code for tokens
5. Server redirects to frontend with tokens

### Protected Routes
Use Passport middleware to protect routes:

```javascript
import { authenticateJWT, authorize } from '../config/passport'

// Require authentication
router.get('/profile', authenticateJWT, (req, res) => {
  res.json({ user: req.user })
})

// Require specific role
router.get('/admin', authenticateJWT, authorize(['ADMIN']), (req, res) => {
  res.json({ adminData: 'protected' })
})
```

## Security Features

### Rate Limiting
- Authentication endpoints have stricter rate limiting
- Configurable limits via environment variables

### Session Management
- Redis-based session storage
- Automatic session cleanup
- Secure cookie configuration

### Token Security
- Separate secrets for access and refresh tokens
- Configurable expiration times
- Token revocation on logout

## Migration Steps

1. Install dependencies: `npm install`
2. Update environment variables
3. Run database migrations: `npm run db:migrate`
4. Start development server: `npm run dev`

## Backward Compatibility

The migration maintains API compatibility:
- Same endpoint structure
- Same response format
- Existing JWT tokens continue to work
- Gradual migration possible

## Testing

Test the authentication system:

```bash
# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test protected route
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <access_token>"
```

## Production Considerations

1. **Environment Variables**: Ensure all secrets are set in production
2. **Redis**: Required for session storage in production
3. **HTTPS**: Required for social OAuth callbacks
4. **CORS**: Configure appropriate origins for your frontend
5. **Database**: Run migrations before starting production server

## Troubleshooting

### Common Issues

1. **Redis Connection**: Ensure Redis is running and accessible
2. **OAuth Callbacks**: Verify callback URLs match OAuth app settings
3. **Token Expiration**: Check token expiration settings
4. **CORS Issues**: Verify frontend origin is allowed

### Debug Mode

Set `NODE_ENV=development` for detailed error messages and stack traces.
