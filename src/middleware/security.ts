import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import {Request, Response, NextFunction} from 'express';

// CORS configuration
export const corsOptions = {
  'origin': (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {

    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {

      callback(null, true);

    } else {

      callback(new Error('Not allowed by CORS'), false);

    }

  },
  'credentials': true,
  'methods': ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  'allowedHeaders': ['Content-Type', 'Authorization', 'X-Requested-With'],
  'exposedHeaders': ['X-Total-Count', 'X-Page-Count']
};

// Rate limiting configuration
export const rateLimiter = rateLimit({
  'windowMs': parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  'max': parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  'message': {
    'error': 'Too many requests from this IP, please try again later.',
    'retryAfter': Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000)
  },
  'standardHeaders': true, // Return rate limit info in the `RateLimit-*` headers
  'legacyHeaders': false, // Disable the `X-RateLimit-*` headers
  'skip': (req: Request) => {

    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';

  }
});

// Strict rate limiting for authentication endpoints
export const authRateLimiter = rateLimit({
  'windowMs': 15 * 60 * 1000, // 15 minutes
  'max': 5, // limit each IP to 5 requests per windowMs
  'message': {
    'error': 'Too many authentication attempts, please try again later.',
    'retryAfter': 900
  },
  'standardHeaders': true,
  'legacyHeaders': false,
  'skipSuccessfulRequests': true
});

// Helmet configuration for security headers
export const helmetConfig = helmet({
  'contentSecurityPolicy': {
    'directives': {
      'defaultSrc': ['\'self\''],
      'styleSrc': ['\'self\'', '\'unsafe-inline\''],
      'scriptSrc': ['\'self\''],
      'imgSrc': ['\'self\'', 'data:', 'https:'],
      'connectSrc': ['\'self\''],
      'fontSrc': ['\'self\''],
      'objectSrc': ['\'none\''],
      'mediaSrc': ['\'self\''],
      'frameSrc': ['\'none\'']
    }
  },
  'crossOriginEmbedderPolicy': false, // Disable for compatibility with some browsers
  'hsts': {
    'maxAge': 31536000, // 1 year
    'includeSubDomains': true,
    'preload': true
  }
});

// Security middleware to set custom headers
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {

  // Remove server information
  res.removeHeader('X-Powered-By');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader('Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  next();

};

// IP whitelist middleware (optional)
export const ipWhitelist = (allowedIPs: string[]) => {

  return (req: Request, res: Response, next: NextFunction) => {

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

    if (!allowedIPs.includes(clientIP as string)) {

      return res.status(403).json({
        'error': 'Access denied: IP not whitelisted',
        'ip': clientIP
      });

    }

    next();

  };

};
