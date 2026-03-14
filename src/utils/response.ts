import { Response } from 'express';
import httpStatus from 'http-status';

/**
 * Success Response Interface
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    timestamp?: string;
  };
}

/**
 * Error Response Interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string; // Only in development
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * API Response Utility Class
 */
export class ApiResponse {
  /**
   * Send success response
   */
  static success<T>(
    res: Response,
    data: T,
    options?: {
      message?: string;
      statusCode?: number;
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }
  ): Response {
    const response: SuccessResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: options?.pagination,
      },
    };

    if (options?.message) {
      response.message = options.message;
    }

    return res.status(options?.statusCode || httpStatus.OK).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    options: {
      code: string;
      message: string;
      statusCode?: number;
      details?: any;
      stack?: string;
    }
  ): Response {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: options.code,
        message: options.message,
        details: options.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    // Include stack trace only in development
    if (process.env.NODE_ENV === 'development' && options.stack) {
      response.error.stack = options.stack;
    }

    return res.status(options.statusCode || httpStatus.INTERNAL_SERVER_ERROR).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(
    res: Response,
    message: string,
    details?: any
  ): Response {
    return this.error(res, {
      code: 'VALIDATION_ERROR',
      message,
      statusCode: httpStatus.BAD_REQUEST,
      details,
    });
  }

  /**
   * Send not found error response
   */
  static notFound(
    res: Response,
    message: string = 'Resource not found',
    details?: any
  ): Response {
    return this.error(res, {
      code: 'NOT_FOUND',
      message,
      statusCode: httpStatus.NOT_FOUND,
      details,
    });
  }

  /**
   * Send unauthorized error response
   */
  static unauthorized(
    res: Response,
    message: string = 'Unauthorized access',
    details?: any
  ): Response {
    return this.error(res, {
      code: 'UNAUTHORIZED',
      message,
      statusCode: httpStatus.UNAUTHORIZED,
      details,
    });
  }

  /**
   * Send forbidden error response
   */
  static forbidden(
    res: Response,
    message: string = 'Forbidden access',
    details?: any
  ): Response {
    return this.error(res, {
      code: 'FORBIDDEN',
      message,
      statusCode: httpStatus.FORBIDDEN,
      details,
    });
  }

  /**
   * Send conflict error response
   */
  static conflict(
    res: Response,
    message: string = 'Resource conflict',
    details?: any
  ): Response {
    return this.error(res, {
      code: 'CONFLICT',
      message,
      statusCode: httpStatus.CONFLICT,
      details,
    });
  }

  /**
   * Send internal server error response
   */
  static internalServerError(
    res: Response,
    message: string = 'Internal server error',
    error?: Error
  ): Response {
    return this.error(res, {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      stack: error?.stack,
    });
  }
}

/**
 * Standard HTTP Status Codes from http-status package
 */
export const HttpStatus = httpStatus;
