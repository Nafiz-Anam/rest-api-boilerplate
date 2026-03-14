import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import logger from '../config/logger';
import { postSchemas } from '../validation/post';
import {
  CreatePostInput,
  UpdatePostInput,
  SearchPostsInput,
  LikePostInput,
  AddCommentInput,
} from '../types/post';
import { asyncHandler } from '../utils/asyncHandler';

export const createPost = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { title, content, excerpt, tags, published } =
      postSchemas.create.parse(req.body) as CreatePostInput;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No valid token provided',
        code: 'TOKEN_MISSING',
      });
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const post = await prisma.post.create({
      data: {
        title,
        content,
        tags: tags || [],
        published: published ?? false,
        slug,
        authorId: userId,
        readTime: Math.ceil(content.length / 200), // Estimate reading time (200 words per minute)
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

    logger.info(`Post created: ${title} by user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post },
    });
  } catch (error: any) {
    logger.error('Create post error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const getPosts = asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      query,
      authorId,
      tags,
      published,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = postSchemas.search.parse(req.query) as SearchPostsInput;

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

    const skip = (page - 1) * limit;
    const take = limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
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
        orderBy: { [sortBy]: sortOrder },
        skip,
        take,
      }),
      prisma.post.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: 'Posts retrieved successfully',
      data: {
        items: posts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const getPostById = asyncHandler(async (req: Request, res: Response) => {
  try {
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
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    // Check if post is published or user is the author
    if (
      !post.published &&
      (!(req as any).user || post.authorId !== (req as any).user.id)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED',
      });
    }

    res.json({
      success: true,
      message: 'Post retrieved successfully',
      data: { post },
    });
  } catch (error: any) {
    logger.error('Get post by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, tags, published } =
      postSchemas.update.parse(req.body) as UpdatePostInput;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No valid token provided',
        code: 'TOKEN_MISSING',
      });
    }

    // Check if post exists and user is the author
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    if (existingPost.authorId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only author can update this post',
        code: 'ACCESS_DENIED',
      });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
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

    logger.info(`Post updated: ${updatedPost.title} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Post updated successfully',
      data: { post: updatedPost },
    });
  } catch (error: any) {
    logger.error('Update post error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No valid token provided',
        code: 'TOKEN_MISSING',
      });
    }

    // Check if post exists and user is the author or admin
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    if (existingPost.authorId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only author or admin can delete this post',
        code: 'ACCESS_DENIED',
      });
    }

    await prisma.post.delete({
      where: { id },
    });

    logger.info(`Post deleted: ${existingPost.title} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const toggleLike = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No valid token provided',
        code: 'TOKEN_MISSING',
      });
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
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
  } catch (error: any) {
    logger.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = postSchemas.addComment.parse(
      req.body
    ) as AddCommentInput;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No valid token provided',
        code: 'TOKEN_MISSING',
      });
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, published: true },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }

    if (!post.published && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
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

    logger.info(`Comment added to post ${id} by user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comment },
    });
  } catch (error: any) {
    logger.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/*
 * SWAGGER API DOCUMENTATION
 * =========================
 *
 * Create new post
 * @swagger
 * tags:
 *   - Posts
 * summary: Create post
 * description: Create a new post with title, content, and optional metadata
 * security:
 *   - bearerAuth: []
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - title
 *           - content
 *         properties:
 *           title:
 *             type: string
 *             description: Post title
 *             example: My First Post
 *           content:
 *             type: string
 *             description: Post content in Markdown or HTML
 *             example: "# Hello World\nThis is my first post content."
 *           excerpt:
 *             type: string
 *             description: Brief post summary
 *             example: A brief summary of the post content.
 *           tags:
 *             type: array
 *             items:
 *               type: string
 *             description: Post tags for categorization
 *             example: ["nodejs", "typescript", "api"]
 *           published:
 *             type: boolean
 *             description: Whether the post is published
 *             example: true
 * responses:
 *   201:
 *     description: Post created successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   400:
 *     description: Bad request - Invalid input data
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   401:
 *     description: Unauthorized - No valid token provided
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Get posts list (public)
 * @swagger
 * tags:
 *   - Posts
 * summary: Get posts
 * description: Retrieve a paginated list of posts with optional filtering
 * parameters:
 *   - in: query
 *     name: query
 *     schema:
 *       type: string
 *     description: Search query
 *   - in: query
 *     name: authorId
 *     schema:
 *       type: string
 *     description: Filter by author ID
 *   - in: query
 *     name: tags
 *     schema:
 *       type: array
 *       items:
 *         type: string
 *     description: Filter by tags
 *   - in: query
 *     name: published
 *     schema:
 *       type: boolean
 *     description: Filter by published status
 *   - in: query
 *     name: page
 *     schema:
 *       type: integer
 *     description: Page number
 *   - in: query
 *     name: limit
 *     schema:
 *       type: integer
 *     description: Number of results per page
 *   - in: query
 *     name: sortBy
 *     schema:
 *       type: string
 *       enum: [createdAt, updatedAt, title]
 *     description: Sort field
 *   - in: query
 *     name: sortOrder
 *     schema:
 *       type: string
 *       enum: [asc, desc]
 *     description: Sort order
 * responses:
 *   200:
 *     description: Posts retrieved successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/PaginatedResponse'
 *   400:
 *     description: Bad request - Invalid query parameters
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Get post by ID
 * @swagger
 * tags:
 *   - Posts
 * summary: Get post by ID
 * description: Retrieve a specific post by its ID
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: Post ID
 * responses:
 *   200:
 *     description: Post retrieved successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   403:
 *     description: Forbidden - Access denied (unpublished post)
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   404:
 *     description: Post not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Update post
 * @swagger
 * tags:
 *   - Posts
 * summary: Update post
 * description: Update an existing post (author or admin only)
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: Post ID
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         properties:
 *           title:
 *             type: string
 *             description: Post title
 *             example: Updated Post Title
 *           content:
 *             type: string
 *             description: Post content
 *             example: Updated content...
 *           excerpt:
 *             type: string
 *             description: Post excerpt
 *             example: Updated excerpt
 *           tags:
 *             type: array
 *             items:
 *               type: string
 *             description: Post tags
 *             example: ["nodejs", "typescript"]
 *           published:
 *             type: boolean
 *             description: Published status
 *             example: true
 * responses:
 *   200:
 *     description: Post updated successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   403:
 *     description: Forbidden - Only author can update this post
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   404:
 *     description: Post not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Delete post
 * @swagger
 * tags:
 *   - Posts
 * summary: Delete post
 * description: Delete a post (author or admin only)
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: Post ID
 * responses:
 *   200:
 *     description: Post deleted successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   403:
 *     description: Forbidden - Only author or admin can delete this post
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   404:
 *     description: Post not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Like/unlike post
 * @swagger
 * tags:
 *   - Posts
 * summary: Like post
 * description: Like or unlike a post
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: Post ID
 * responses:
 *   200:
 *     description: Post liked/unliked successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   404:
 *     description: Post not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Add comment to post
 * @swagger
 * tags:
 *   - Posts
 * summary: Add comment
 * description: Add a comment to a post
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: Post ID
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - content
 *         properties:
 *           content:
 *             type: string
 *             description: Comment content
 *             example: Great post! Thanks for sharing.
 * responses:
 *   201:
 *     description: Comment added successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Success'
 *   403:
 *     description: Forbidden - Cannot comment on unpublished posts
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   404:
 *     description: Post not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */
