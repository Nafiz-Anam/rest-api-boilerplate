# Swagger/OpenAPI Documentation Setup

This guide explains how to set up and use automated API documentation with Swagger/OpenAPI 3.0.

## Overview

The project includes comprehensive Swagger/OpenAPI documentation that automatically generates from JSDoc comments in your TypeScript code. This provides interactive API documentation that's always up-to-date with your codebase.

## Features

### 🚀 Automated Documentation
- **Live API Documentation**: Always synchronized with your code
- **Interactive Testing**: Try API endpoints directly from the browser
- **Schema Validation**: See all request/response schemas
- **Authentication Testing**: Test authenticated endpoints easily
- **Multiple Formats**: Export to JSON, YAML, or HTML

### 📊 Comprehensive Coverage
- **All Endpoints**: Authentication, Users, Posts, System
- **Request/Response Models**: Complete schema definitions
- **Error Handling**: Standardized error responses
- **Security Schemes**: JWT Bearer authentication
- **Tag Organization**: Logical grouping of endpoints

### 🎨 Customizable Interface
- **Branded UI**: Custom styling and branding
- **Multi-server Support**: Development and production URLs
- **API Versioning**: Version-aware documentation
- **Markdown Support**: Rich text descriptions with formatting

## Setup Instructions

### 1. Install Dependencies

```bash
# Install Swagger dependencies
pnpm install swagger-jsdoc swagger-ui-express jsdoc jsdoc-markdown http-server
```

### 2. Generate Documentation

```bash
# Generate documentation from JSDoc comments
pnpm run docs:generate

# Serve documentation locally
pnpm run docs:serve
```

### 3. Access Documentation

- **Swagger UI**: `http://localhost:8081`
- **API Spec**: `http://localhost:8081/api-docs.json`
- **Production**: `https://your-domain.com/api-docs`

## JSDoc Comments Format

### Basic Route Documentation

```typescript
/**
 * @swagger
 * tags:
 *   - Users
 * summary: Get user profile
 * description: Retrieve the authenticated user's profile information
 * security:
 *   - bearerAuth: []
 * responses:
 *   200:
 *     description: User profile retrieved successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 */
router.get('/profile', authenticateJWT, asyncHandler(async (req: any, res: any) => {
  // Your implementation
}));
```

### Request Body Documentation

```typescript
/**
 * @swagger
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - email
 *           - password
 *         properties:
 *           email:
 *             type: string
 *             format: email
 *             description: User email address
 *             example: user@example.com
 */
router.post('/login', asyncHandler(async (req: any, res: any) => {
  // Your implementation
}));
```

### Response Documentation

```typescript
/**
 * @swagger
 * responses:
 *   200:
 *     description: Success response
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *         example:
 *           success: true
 *           message: "Operation completed successfully"
 *           data:
 *             user: { id: "cuid123", email: "user@example.com" }
 *   400:
 *     description: Bad request
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */
```

## Schema Components

### User Schema
```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - id
 *         - email
 *         - username
 *       properties:
 *         id:
 *           type: string
 *           description: User unique identifier
 *           example: cuid123456789
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: user@example.com
 */
```

### Error Schema
```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       required:
 *         - success
 *         - error
 *         - code
 *       properties:
 *         success:
 *           type: boolean
 *           description: Whether the operation was successful
 *           example: false
 *         error:
 *           type: string
 *           description: Error message
 *           example: User not found
 *         code:
 *           type: string
 *           description: Machine-readable error code
 *           example: USER_NOT_FOUND
 */
```

## Security Documentation

### JWT Authentication
```typescript
/**
 * @swagger
 * security:
 *   - bearerAuth: []
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT access token for authentication
 */
```

### Role-based Access
```typescript
/**
 * @swagger
 * security:
 *   - bearerAuth: []
 * tags:
 *   - Admin
 * description: Admin-only endpoint
 */
router.get('/admin/users', authenticateJWT, authorize(['ADMIN']), asyncHandler(async (req: any, res: any) => {
  // Admin-only implementation
}));
```

## Advanced Features

### Multiple Servers
```typescript
/**
 * @swagger
 * servers:
 *   - url: http://localhost:3000
 *     description: Development server
 *   - url: https://api.your-domain.com
 *     description: Production server
 */
```

### API Versioning
```typescript
/**
 * @swagger
 * info:
 *   version: 1.0.0
 *   description: API version information
 */
```

### Custom Tags
```typescript
/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication and authorization endpoints
 *   - name: Users
 *     description: User management endpoints
 *   - name: Posts
 *     description: Content management endpoints
 */
```

## Configuration Options

### JSDoc Configuration (`jsdoc.json`)

```json
{
  "source": {
    "include": ["./src/**/*.ts"],
    "exclude": ["./src/**/*.test.ts"]
  },
  "opts": {
    "destination": "./docs",
    "recurse": true,
    "template": "node_modules/swagger-jsdoc/dist/template"
  },
  "plugins": [
    "plugins/markdown",
    "plugins/summarize"
  ]
}
```

### Swagger UI Options

```typescript
// src/config/swagger.ts
export const swaggerUiOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { 
      background-color: #1a1a1a; 
    }
    .swagger-ui .info { 
      margin: 20px 0; 
    }
  `,
  customSiteTitle: 'API Documentation',
};
```

## Usage Examples

### 1. Development Workflow

```bash
# Start development server
pnpm run dev

# Generate documentation in another terminal
pnpm run docs:generate

# Serve documentation
pnpm run docs:serve

# Access at http://localhost:8081
```

### 2. Testing APIs

1. Open `http://localhost:8081` in your browser
2. Click on any endpoint to expand details
3. Click "Try it out" to test the endpoint
4. Fill in request parameters
5. Click "Execute" to send the request
6. View response and status code

### 3. Authentication Testing

```bash
# Get JWT token from login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token in Swagger UI
# Click "Authorize" button in Swagger UI
# Enter: Bearer <your-jwt-token>
```

### 4. Export Documentation

```bash
# Export as JSON
curl http://localhost:8081/api-docs.json > api-spec.json

# Export as YAML
curl http://localhost:8081/api-docs.yaml > api-spec.yaml
```

## Best Practices

### 1. Documentation Quality

- **Complete Descriptions**: Explain what each endpoint does
- **Parameter Details**: Include types, examples, and constraints
- **Response Examples**: Show actual response formats
- **Error Handling**: Document all possible error responses

### 2. Schema Design

- **Reusable Components**: Use `$ref` for common schemas
- **Type Safety**: Define proper types and constraints
- **Validation Rules**: Include validation rules in descriptions
- **Examples**: Provide realistic examples

### 3. Security Documentation

- **Authentication Flow**: Document complete auth process
- **Permission Levels**: Clearly mark required roles
- **Token Format**: Explain JWT structure and claims
- **Security Headers**: Document required headers

### 4. Organization

- **Logical Grouping**: Group related endpoints
- **Consistent Naming**: Use clear, descriptive names
- **Version Management**: Document version changes
- **Deprecation Notices**: Mark deprecated endpoints

## Integration with CI/CD

### Automated Generation

```bash
# Add to build process
pnpm run docs:generate

# Include in deployment pipeline
- name: Generate Documentation
  run: pnpm run docs:generate
```

### Hosting Options

1. **Static Hosting**: Deploy `docs/` folder to static hosting
2. **CDN Integration**: Serve via CDN for global access
3. **API Gateway**: Use API gateway with built-in documentation
4. **Docker Container**: Include documentation in Docker image

## Troubleshooting

### Common Issues

1. **Missing Documentation**:
   - Add JSDoc comments to all routes
   - Run `pnpm run docs:generate` after changes

2. **Schema Errors**:
   - Check JSDoc syntax for typos
   - Validate JSON structure in `jsdoc.json`

3. **UI Not Loading**:
   - Ensure `swagger-ui-express` is properly configured
   - Check static file serving

4. **Authentication Issues**:
   - Verify JWT configuration
   - Check security scheme definitions

### Debug Mode

```javascript
// Enable debug logging
process.env.SWAGGER_DEBUG = 'true';

// Check generated spec
console.log(specs);
```

## Advanced Customization

### Custom Templates

```bash
# Create custom template
mkdir templates/swagger
# Modify template files
# Update jsdoc.json template path
```

### Plugin Integration

```json
{
  "plugins": [
    "plugins/markdown",
    "plugins/summarize",
    "plugins/custom-stats"
  ]
}
```

### Multi-version Support

```typescript
// Configure multiple API versions
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      description: 'Current API version'
    },
    servers: [
      { url: 'https://api.v1.your-domain.com', description: 'API v1' },
      { url: 'https://api.v2.your-domain.com', description: 'API v2' }
    ]
  }
};
```

This comprehensive Swagger setup ensures your API documentation is always current, interactive, and production-ready!
