import { z } from 'zod';

export const userSchemas = {
  updateProfile: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    avatar: z.string().url().optional(),
    bio: z.string().max(500).optional(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100),
  }),

  search: z.object({
    query: z.string().min(1).max(100).optional(),
    role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform(val => val === 'true')
      .optional(),
    createdAfter: z.string().datetime().optional(),
    createdBefore: z.string().datetime().optional(),
    lastLoginAfter: z.string().datetime().optional(),
    page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
    limit: z
      .string()
      .transform(Number)
      .pipe(z.number().min(1).max(100))
      .default('20'),
    sortBy: z
      .enum(['username', 'email', 'createdAt', 'updatedAt', 'lastLoginAt'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};
