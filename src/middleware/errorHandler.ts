import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import logger from '../config/logger';
import { ApiResponse } from '../utils/response';
import HttpStatus from 'http-status';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error types
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, HttpStatus.NOT_FOUND, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, HttpStatus.FORBIDDEN, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.CONFLICT, 'CONFLICT', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED');
  }
}

// Error handling middleware
export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'Internal server error';
  let details = error.details;

  // Log the error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  // Handle specific error types
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(error);
    statusCode = prismaError.statusCode;
    code = prismaError.code;
    message = prismaError.message;
    details = prismaError.details;
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
  } else if (error instanceof Prisma.PrismaClientRustPanicError) {
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    code = 'DATABASE_PANIC';
    message = 'Database panic occurred';
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    code = 'DATABASE_CONNECTION_ERROR';
    message = 'Database connection failed';
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = HttpStatus.BAD_REQUEST;
    code = 'DATABASE_VALIDATION_ERROR';
    message = 'Database validation failed';
    details = error.message;
  } else if (error instanceof ZodError) {
    statusCode = HttpStatus.BAD_REQUEST;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = HttpStatus.UNAUTHORIZED;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = HttpStatus.UNAUTHORIZED;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (error.name === 'MulterError') {
    const multerError = handleMulterError(error as any);
    statusCode = multerError.statusCode;
    code = multerError.code;
    message = multerError.message;
    details = multerError.details;
  }

  // Use ApiResponse to send standardized error response
  return ApiResponse.error(res, {
    code,
    message,
    statusCode,
    details,
    stack: error.stack,
  });
};

// Handle Prisma errors
const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError) => {
  switch (error.code) {
    case 'P2002':
      return {
        statusCode: HttpStatus.CONFLICT,
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'A record with this value already exists',
        details: {
          field: error.meta?.target,
        },
      };
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        code: 'RECORD_NOT_FOUND',
        message: 'Record not found',
        details: error.meta,
      };
    case 'P2003':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'FOREIGN_KEY_CONSTRAINT',
        message: 'Foreign key constraint violation',
        details: error.meta,
      };
    case 'P2014':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'RELATION_VIOLATION',
        message: 'Relation violation',
        details: error.meta,
      };
    case 'P2021':
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'TABLE_NOT_FOUND',
        message: 'Table does not exist',
        details: error.meta,
      };
    case 'P2022':
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'COLUMN_NOT_FOUND',
        message: 'Column does not exist',
        details: error.meta,
      };
    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        details: { code: error.code, meta: error.meta },
      };
  }
};

// Handle Multer errors (file upload)
const handleMulterError = (error: any) => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return {
        statusCode: 413, // HTTP 413 Request Entity Too Large
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds limit',
        details: { limit: error.limit },
      };
    case 'LIMIT_FILE_COUNT':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'TOO_MANY_FILES',
        message: 'Too many files uploaded',
        details: { limit: error.limit },
      };
    case 'LIMIT_UNEXPECTED_FILE':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'UNEXPECTED_FILE',
        message: 'Unexpected file field',
        details: { field: error.field },
      };
    default:
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'FILE_UPLOAD_ERROR',
        message: 'File upload failed',
        details: error,
      };
  }
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Global unhandled exception handler
export const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};

// Error response formatter
export const formatErrorResponse = (
  error: ApiError,
  includeStack: boolean = false
) => {
  const response: any = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
      ...(error.details && { details: error.details }),
    },
  };

  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
};

// Validation error helper
export const createValidationError = (errors: any[]) => {
  return new ValidationError('Validation failed', errors);
};

// Rate limit error helper
export const createRateLimitError = (retryAfter?: number) => {
  const error = new RateLimitError('Too many requests');
  if (retryAfter) {
    error.details = { retryAfter };
  }
  return error;
};
