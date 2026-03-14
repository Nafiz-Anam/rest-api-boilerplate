# API Documentation

## Overview

This is a production-ready REST API built with Node.js, Express, TypeScript, and Prisma. It provides authentication, user management, post management, and real-time WebSocket features.

## Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## Rate Limiting

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes
- Rate limit headers are included in all responses

## Endpoints

### Authentication (`/api/auth`)

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-token-here"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access-token>
```

#### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <access-token>
```

#### Social Authentication
```http
GET /api/auth/google
GET /api/auth/google/callback
GET /api/auth/github
GET /api/auth/github/callback
```

### Users (`/api/users`)

*All user endpoints require authentication*

#### Get Current User Profile
```http
GET /api/users/profile
Authorization: Bearer <access-token>
```

#### Update Profile
```http
PUT /api/users/profile
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "avatar": "https://example.com/avatar.jpg",
  "bio": "Software developer"
}
```

#### Change Password
```http
POST /api/users/change-password
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

#### Search Users (Admin only)
```http
GET /api/users?query=john&page=1&limit=20&sortBy=username&sortOrder=asc
Authorization: Bearer <access-token>
```

#### Get User by ID (Admin only)
```http
GET /api/users/:id
Authorization: Bearer <access-token>
```

#### Update User Status (Admin only)
```http
PATCH /api/users/:id/status
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "isActive": false
}
```

#### Delete User (Admin only)
```http
DELETE /api/users/:id
Authorization: Bearer <access-token>
```

### Posts (`/api/posts`)

#### Create Post
```http
POST /api/posts
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "title": "My First Post",
  "content": "This is the content of my post...",
  "excerpt": "A brief summary",
  "tags": ["nodejs", "typescript", "api"],
  "published": true
}
```

#### Get Posts
```http
GET /api/posts?query=nodejs&page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

#### Get Post by ID
```http
GET /api/posts/:id
```

#### Update Post
```http
PUT /api/posts/:id
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "title": "Updated Post Title",
  "content": "Updated content...",
  "published": true
}
```

#### Delete Post
```http
DELETE /api/posts/:id
Authorization: Bearer <access-token>
```

#### Like/Unlike Post
```http
POST /api/posts/:id/like
Authorization: Bearer <access-token>
```

#### Add Comment to Post
```http
POST /api/posts/:id/comments
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "content": "Great post! Thanks for sharing."
}
```

### Health Check

#### Server Health
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "development",
  "version": "1.0.0"
}
```

### API Information

#### API Documentation
```http
GET /api
```

#### WebSocket Info
```http
GET /api/websocket/info
```

## Data Models

### User
```json
{
  "id": "string",
  "email": "string",
  "username": "string",
  "firstName": "string",
  "lastName": "string",
  "avatar": "string",
  "role": "USER|MODERATOR|ADMIN",
  "isActive": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Post
```json
{
  "id": "string",
  "title": "string",
  "content": "string",
  "excerpt": "string",
  "slug": "string",
  "published": "boolean",
  "featured": "boolean",
  "tags": ["string"],
  "readTime": "number",
  "viewCount": "number",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "publishedAt": "datetime",
  "author": {
    "id": "string",
    "username": "string",
    "firstName": "string",
    "lastName": "string",
    "avatar": "string"
  }
}
```

### Comment
```json
{
  "id": "string",
  "content": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "author": {
    "id": "string",
    "username": "string",
    "firstName": "string",
    "lastName": "string",
    "avatar": "string"
  }
}
```

## Error Codes

### Authentication Errors
- `TOKEN_MISSING`: No access token provided
- `TOKEN_INVALID`: Access token is invalid or expired
- `INVALID_CREDENTIALS`: Email or password is incorrect
- `USER_EXISTS`: User already exists
- `USER_NOT_FOUND`: User not found
- `INVALID_PASSWORD`: Current password is incorrect

### Authorization Errors
- `ACCESS_DENIED`: Insufficient permissions
- `INSUFFICIENT_PERMISSIONS`: User role is not sufficient

### Validation Errors
- `VALIDATION_ERROR`: Request data is invalid
- `MISSING_FIELDS`: Required fields are missing

### Rate Limiting Errors
- `TOO_MANY_REQUESTS`: Rate limit exceeded

### Server Errors
- `INTERNAL_ERROR`: Internal server error
- `DATABASE_ERROR`: Database operation failed

## WebSocket Events

### Connection
```javascript
const socket = io('ws://localhost:3000');

// Authenticate
socket.emit('authenticate', { token: 'your-jwt-token' });
```

### Events
- `authenticated`: User successfully authenticated
- `user_connected`: New user connected
- `user_disconnected`: User disconnected
- `post_created`: New post created
- `post_updated`: Post updated
- `post_liked`: Post liked
- `comment_added`: New comment added

## Pagination

List endpoints support pagination:

```http
GET /api/posts?page=2&limit=10
```

Response:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 2,
      "limit": 10,
      "total": 100,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": true
    }
  }
}
```

## Search and Filtering

### Search
```http
GET /api/posts?query=nodejs
```

### Filter by Tags
```http
GET /api/posts?tags=nodejs,typescript
```

### Filter by Author
```http
GET /api/posts?authorId=user-id
```

### Sort Options
- `sortBy`: `createdAt`, `updatedAt`, `title`
- `sortOrder`: `asc`, `desc`

## Environment Variables

Required environment variables for development:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-refresh-token-secret"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Session
SESSION_SECRET="your-session-secret"
REDIS_URL="redis://localhost:6379"

# Social Auth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"

GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GITHUB_CALLBACK_URL="http://localhost:3000/api/auth/github/callback"

# CORS
CORS_ORIGIN="http://localhost:3000"
```

## Testing

Run the test suite:

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run tests in watch mode
pnpm test:watch
```

## Development

### Setup Development Environment

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Set up PostgreSQL and Redis
4. Copy `.env.example` to `.env` and configure
5. Run database migrations: `pnpm run db:migrate`
6. Start development server: `pnpm run dev`

### Available Scripts

- `pnpm dev`: Start development server with hot reload
- `pnpm build`: Build for production
- `pnpm start`: Start production server
- `pnpm test`: Run test suite
- `pnpm lint`: Run ESLint
- `pnpm lint:fix`: Fix ESLint issues
- `pnpm db:generate`: Generate Prisma client
- `pnpm db:migrate`: Run database migrations
- `pnpm db:studio`: Open Prisma Studio

## Security Features

- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on all endpoints
- CORS configuration
- Security headers (Helmet)
- Input validation and sanitization
- SQL injection prevention via Prisma ORM
- XSS protection

## Performance Features

- Response compression
- Database query optimization
- Pagination for large datasets
- Caching with Redis
- Connection pooling

## Monitoring & Logging

- Structured logging with Winston
- Request/response logging with Morgan
- Error tracking and reporting
- Performance metrics
- Health check endpoints

## Deployment

The API is containerized and ready for deployment:

### Docker
```bash
# Build image
docker build -t productionready-api .

# Run container
docker run -p 3000:3000 productionready-api
```

### Docker Compose
```bash
docker-compose up -d
```

### Environment Variables
Ensure all required environment variables are set in production.

### Database
Run migrations before starting the production server.

## Support

For issues and questions:
- Check the documentation
- Review the error codes
- Check the logs
- Create an issue in the repository

## License

This project is licensed under the MIT License.
