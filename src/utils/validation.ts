import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Common validation schemas
const emailSchema = z.string().email('Invalid email format');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain at least one special character'
  );

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters long')
  .max(30, 'Username must not exceed 30 characters')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  );

// User validation schemas
export const userSchemas = {
  register: z.object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    firstName: z.string().min(1, 'First name is required').max(50).optional(),
    lastName: z.string().min(1, 'Last name is required').max(50).optional(),
  }),

  login: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),

  updateProfile: z.object({
    email: emailSchema.optional(),
    username: usernameSchema.optional(),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    avatar: z.string().url('Invalid avatar URL').optional(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  }),
};

// Post validation schemas
export const postSchemas = {
  create: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    content: z.string().min(1, 'Content is required'),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .max(200)
      .regex(
        /^[a-z0-9-]+$/,
        'Slug can only contain lowercase letters, numbers, and hyphens'
      ),
    published: z.boolean().default(false),
    featured: z.boolean().default(false),
    tags: z.array(z.string().min(1).max(50)).max(10).default([]),
    readTime: z.number().int().min(1).max(999).optional(),
  }),

  update: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    slug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    published: z.boolean().optional(),
    featured: z.boolean().optional(),
    tags: z.array(z.string().min(1).max(50)).max(10).optional(),
    readTime: z.number().int().min(1).max(999).optional(),
  }),

  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, 'Page must be a number')
      .transform(Number)
      .default('1'),
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a number')
      .transform(Number)
      .default('10'),
    search: z.string().optional(),
    published: z
      .enum(['true', 'false'])
      .transform(val => val === 'true')
      .optional(),
    featured: z
      .enum(['true', 'false'])
      .transform(val => val === 'true')
      .optional(),
    tags: z
      .string()
      .optional()
      .transform(val => val?.split(',')),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'title', 'viewCount'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

// Comment validation schemas
export const commentSchemas = {
  create: z.object({
    content: z.string().min(1, 'Comment content is required').max(1000),
    postId: z.string().min(1, 'Post ID is required'),
    parentId: z.string().optional(),
  }),

  update: z.object({
    content: z.string().min(1, 'Comment content is required').max(1000),
  }),

  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
    postId: z.string().optional(),
  }),
};

// Pagination and sorting utilities
export const paginationSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, 'Page must be a number')
    .transform(Number)
    .default('1'),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .default('10'),
});

export const sortingSchema = z.object({
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Validation middleware factory
export const validate = (
  schema: z.ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validatedData = schema.parse(data);

      // Replace the request data with validated data
      req[source] = validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details: errorMessages,
        });
      }

      return res.status(500).json({
        error: 'Internal server error during validation',
      });
    }

    // Explicit return for TypeScript
    return;
  };
};

// Custom validation functions
export const validateSlug = (slug: string): boolean => {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug);
};

export const validatePasswordStrength = (
  password: string
): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('Password should be at least 8 characters long');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Password should contain at least one uppercase letter');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Password should contain at least one lowercase letter');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Password should contain at least one number');

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push('Password should contain at least one special character');

  return {
    isValid: score >= 4,
    score,
    feedback,
  };
};

// Sanitization utilities
export const sanitizeHtml = (content: string): string => {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

// File validation schemas
export const fileSchemas = {
  upload: z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.string(),
    size: z.number().max(5 * 1024 * 1024, 'File size must not exceed 5MB'),
    buffer: z.instanceof(Buffer),
  }),

  image: z.object({
    mimetype: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    size: z.number().max(2 * 1024 * 1024, 'Image size must not exceed 2MB'),
  }),
};

// Export types for use in controllers
export type UserRegisterInput = z.infer<typeof userSchemas.register>;
export type UserLoginInput = z.infer<typeof userSchemas.login>;
export type UserUpdateInput = z.infer<typeof userSchemas.updateProfile>;
export type PostCreateInput = z.infer<typeof postSchemas.create>;
export type PostUpdateInput = z.infer<typeof postSchemas.update>;
export type PostQueryInput = z.infer<typeof postSchemas.query>;
export type CommentCreateInput = z.infer<typeof commentSchemas.create>;
export type CommentUpdateInput = z.infer<typeof commentSchemas.update>;
