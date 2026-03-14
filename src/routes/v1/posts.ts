import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { authenticateJWT, authorize } from '../../config/passport';
import {
  authenticateToken,
  requirePermission,
  requireRole,
  requireMinimumRole,
  verifyResourceOwnership,
  AuthenticatedRequest,
} from '../../middleware/auth';
import { Role } from '../../config/role';
import { validate } from '../../utils/validation';
import { paginateResults } from '../../utils/pagination';
import { asyncHandler } from '../../utils/asyncHandler';

const router: Router = Router();

// Post schemas for validation
const postSchemas = {
  create: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
    excerpt: z.string().max(500).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
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
};

// Create new post
router.post(
  '/',
  authenticateToken,
  requirePermission('create:post'),
  validate(postSchemas.create),
  asyncHandler(async (req: AuthenticatedRequest, res: any) => {
    const { title, content, excerpt, tags, published } = req.body;
    const authorId = req.user!.id;

    const post = await prisma.post.create({
      data: {
        title,
        content,
        slug: title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, ''),
        tags: tags || [],
        published: published ?? false,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    logger.info(`Post created: ${post.title} by ${req.user!.username}`);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post },
    });
  })
);

// Get posts list (public)
router.get(
  '/',
  validate(postSchemas.search),
  asyncHandler(async (req: any, res: any) => {
    const {
      query,
      authorId,
      tags,
      published,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const where: any = {};

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (published !== undefined) {
      where.published = published;
    } else {
      where.published = true; // Default to published posts only
    }

    const result = await paginateResults(
      prisma.post,
      { page, limit, sortBy, sortOrder },
      where,
      {
        include: {
          author: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
      },
      ['title', 'content', 'createdAt', 'updatedAt']
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get post by ID
router.get(
  '/:id',
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    // Check if post is published or user is the author
    if (!post.published && (!req.user || post.authorId !== req.user.id)) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED',
      });
    }

    res.json({
      success: true,
      data: { post },
    });
  })
);

// Update post
router.put(
  '/:id',
  authenticateJWT,
  validate(postSchemas.update),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { title, content, excerpt, tags, published } = req.body;
    const userId = req.user!.id;

    // Check if post exists and user is the author
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });

    if (!existingPost) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    if (existingPost.authorId !== userId) {
      return res.status(403).json({
        error: 'Only the author can update this post',
        code: 'ACCESS_DENIED',
      });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(excerpt !== undefined && { excerpt }),
        ...(tags && { tags }),
        ...(published !== undefined && { published }),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    logger.info(`Post updated: ${updatedPost.title} by ${req.user!.username}`);

    res.json({
      success: true,
      message: 'Post updated successfully',
      data: { post: updatedPost },
    });
  })
);

// Delete post
router.delete(
  '/:id',
  authenticateJWT,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if post exists and user is the author or admin
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });

    if (!existingPost) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    if (existingPost.authorId !== userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Only the author or admin can delete this post',
        code: 'ACCESS_DENIED',
      });
    }

    await prisma.post.delete({
      where: { id },
    });

    logger.info(`Post deleted: ${existingPost.title} by ${req.user!.username}`);

    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  })
);

// Like post
router.post(
  '/:id/like',
  authenticateJWT,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId: id,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { id: existingLike.id },
      });

      res.json({
        success: true,
        message: 'Post unliked',
        action: 'unliked',
      });
    } else {
      // Like
      await prisma.like.create({
        data: {
          userId,
          postId: id,
        },
      });

      res.json({
        success: true,
        message: 'Post liked',
        action: 'liked',
      });
    }
  })
);

// Add comment to post
router.post(
  '/:id/comments',
  authenticateJWT,
  validate(
    z.object({
      content: z.string().min(1).max(1000),
    })
  ),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, published: true },
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    if (!post.published && req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Cannot comment on unpublished posts',
        code: 'ACCESS_DENIED',
      });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        authorId: userId,
        postId: id,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    logger.info(`Comment added to post ${id} by ${req.user!.username}`);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comment },
    });
  })
);

export default router;
