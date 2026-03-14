import { z } from 'zod';

export const postSchemas = {
  create: z.object({
    title: z
      .string()
      .min(1)
      .max(200, 'Title is required and must be between 1 and 200 characters'),
    content: z
      .string()
      .min(1)
      .max(
        10000,
        'Content is required and must be between 1 and 10000 characters'
      ),
    excerpt: z
      .string()
      .max(500, 'Excerpt must be at most 500 characters')
      .optional(),
    tags: z
      .array(z.string().max(50, 'Each tag must be at most 50 characters'))
      .max(10, 'Maximum 10 tags allowed')
      .optional(),
    published: z.boolean().optional(),
  }),

  update: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(10000).optional(),
    excerpt: z.string().max(500).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    published: z.boolean().optional(),
  }),

  search: z.object({
    query: z.string().min(1).max(100).optional(),
    authorId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    published: z.boolean().optional(),
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z
      .string()
      .transform(Number)
      .pipe(z.number().min(1).max(100))
      .optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),

  like: z.object({
    action: z.enum(['like', 'unlike']).optional(),
  }),

  addComment: z.object({
    content: z
      .string()
      .min(1)
      .max(1000, 'Comment must be between 1 and 1000 characters'),
  }),
};
