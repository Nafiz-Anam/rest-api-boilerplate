# API Response and Error Handling Guide

This guide explains how to use the centralized API response format and error handling system.

## 📋 Overview

We have implemented:
- **Standardized API response format** using `ApiResponse` class
- **Centralized error handling** with custom error classes
- **HTTP status codes** from the `http-status` package
- **Common constants** for status codes, error codes, and messages

## 🎯 API Response Format

### Success Response
```typescript
{
  "success": true,
  "data": { ... }, // Your response data
  "message": "Operation completed successfully", // Optional
  "meta": {
    "timestamp": "2023-03-13T08:00:00.000Z",
    "pagination": { // Optional, for paginated responses
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Error Response
```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { ... } // Optional error details
  },
  "meta": {
    "timestamp": "2023-03-13T08:00:00.000Z"
  }
}
```

## 🚀 Usage Examples

### 1. Import Required Modules
```typescript
import { ApiResponse } from '../utils/response';
import { StatusCodes, ErrorCodes, Messages } from '../utils/constants';
import { ValidationError, NotFoundError, UnauthorizedError } from '../middleware/errorHandler';
```

### 2. Success Responses
```typescript
// Simple success response
return ApiResponse.success(res, userData);

// Success with custom message
return ApiResponse.success(res, userData, {
  message: Messages.CREATED,
  statusCode: StatusCodes.CREATED
});

// Paginated response
return ApiResponse.success(res, postsList, {
  message: "Posts retrieved successfully",
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5,
    hasNext: true,
    hasPrev: false
  }
});
```

### 3. Error Responses
```typescript
// Using ApiResponse directly
return ApiResponse.validationError(res, "Invalid email format");
return ApiResponse.notFound(res, "User not found");
return ApiResponse.unauthorized(res, "Access denied");
return ApiResponse.forbidden(res, "Insufficient permissions");
return ApiResponse.internalServerError(res, "Database error", error);

// Using custom error classes (recommended)
throw new ValidationError("Invalid input data", validationErrors);
throw new NotFoundError("User");
throw new UnauthorizedError("Invalid credentials");
throw new ConflictError("Email already exists");
```

### 4. Complete Controller Example
```typescript
import { Request, Response } from 'express';
import { ApiResponse } from '../utils/response';
import { StatusCodes, Messages } from '../utils/constants';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate input
    if (!id || !isValidUUID(id)) {
      throw new ValidationError("Invalid user ID");
    }
    
    // Find user
    const user = await userService.findById(id);
    if (!user) {
      throw new NotFoundError("User");
    }
    
    // Return success response
    return ApiResponse.success(res, user, {
      message: "User retrieved successfully"
    });
    
  } catch (error) {
    // Let the centralized error handler handle it
    return next(error);
  }
};
```

## 🔧 Error Classes

### Available Error Classes
```typescript
// Base error class
new AppError(message, statusCode, code, details)

// Specific error classes
new ValidationError(message, details)
new NotFoundError(resource)
new UnauthorizedError(message)
new ForbiddenError(message)
new ConflictError(message, details)
new RateLimitError(message)
```

### Throwing Errors
```typescript
// Validation errors with details
throw new ValidationError("Validation failed", [
  { field: "email", message: "Invalid email format" },
  { field: "password", message: "Password too short" }
]);

// Not found errors
throw new NotFoundError("User"); // "User not found"
throw new NotFoundError("Post"); // "Post not found"

// Authorization errors
throw new UnauthorizedError("Invalid token");
throw new ForbiddenError("Admin access required");

// Conflict errors
throw new ConflictError("Email already exists");
```

## 📊 Constants

### Status Codes
```typescript
import { StatusCodes } from '../utils/constants';

StatusCodes.OK              // 200
StatusCodes.CREATED         // 201
StatusCodes.BAD_REQUEST     // 400
StatusCodes.UNAUTHORIZED    // 401
StatusCodes.FORBIDDEN       // 403
StatusCodes.NOT_FOUND       // 404
StatusCodes.CONFLICT        // 409
StatusCodes.TOO_MANY_REQUESTS // 429
StatusCodes.INTERNAL_SERVER_ERROR // 500
```

### Error Codes
```typescript
import { ErrorCodes } from '../utils/constants';

ErrorCodes.VALIDATION_ERROR
ErrorCodes.UNAUTHORIZED
ErrorCodes.NOT_FOUND
ErrorCodes.CONFLICT
ErrorCodes.DATABASE_ERROR
ErrorCodes.RATE_LIMIT_EXCEEDED
```

### Messages
```typescript
import { Messages } from '../utils/constants';

Messages.SUCCESS
Messages.CREATED
Messages.UPDATED
Messages.DELETED
Messages.UNAUTHORIZED
Messages.NOT_FOUND
```

## 🛡️ Error Handling Middleware

The centralized error handler automatically:
- Catches all errors
- Logs them with context
- Formats responses consistently
- Handles specific error types (Prisma, Zod, JWT, etc.)

### Error Handler Features
- **Prisma Errors**: Database-specific error mapping
- **Zod Validation**: Structured validation error details
- **JWT Errors**: Token-related error handling
- **File Upload**: Multer error handling
- **Development Mode**: Includes stack traces in dev

## 🔄 Migration Guide

### Before (Old Format)
```typescript
res.status(200).json({
  success: true,
  data: user,
  message: "User found"
});

res.status(400).json({
  success: false,
  error: "Validation failed",
  details: errors
});
```

### After (New Format)
```typescript
return ApiResponse.success(res, user, {
  message: "User found"
});

return ApiResponse.validationError(res, "Validation failed", errors);

// Or throw custom errors
throw new ValidationError("Validation failed", errors);
```

## 📝 Best Practices

### 1. Use Custom Error Classes
```typescript
// ✅ Good
throw new NotFoundError("User");

// ❌ Avoid
res.status(404).json({ error: "Not found" });
```

### 2. Be Specific with Error Codes
```typescript
// ✅ Good
throw new ValidationError("Invalid email format");

// ❌ Avoid
throw new Error("Something went wrong");
```

### 3. Use Constants for Consistency
```typescript
// ✅ Good
return ApiResponse.success(res, data, {
  statusCode: StatusCodes.CREATED,
  message: Messages.CREATED
});

// ❌ Avoid
return ApiResponse.success(res, data, {
  statusCode: 201,
  message: "Created successfully"
});
```

### 4. Include Helpful Error Details
```typescript
// ✅ Good
throw new ValidationError("Validation failed", [
  { field: "email", message: "Invalid format", code: "INVALID_EMAIL" },
  { field: "password", message: "Too short", code: "PASSWORD_TOO_SHORT" }
]);

// ❌ Avoid
throw new ValidationError("Invalid input");
```

## 🎯 Response Examples

### User Registration Success
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2023-03-13T08:00:00.000Z"
  },
  "message": "User created successfully",
  "meta": {
    "timestamp": "2023-03-13T08:00:00.000Z"
  }
}
```

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_STRING"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters",
        "code": "TOO_SMALL"
      }
    ]
  },
  "meta": {
    "timestamp": "2023-03-13T08:00:00.000Z"
  }
}
```

### Paginated Posts Response
```json
{
  "success": true,
  "data": [
    { "id": 1, "title": "First Post" },
    { "id": 2, "title": "Second Post" }
  ],
  "meta": {
    "timestamp": "2023-03-13T08:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

This system ensures consistent API responses across your entire application while providing excellent error handling and developer experience.
