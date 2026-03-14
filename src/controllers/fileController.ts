import { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';
import logger from '../config/logger';
import {
  FileUploadResponse,
  FileQueryParams,
  CloudinaryUploadResult,
} from '../types';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
      });
    }

    const { mimetype, buffer, originalname, size } = req.file;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
      });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'auto',
            folder: `uploads/${userId}`,
            public_id: `${Date.now()}-${originalname.split('.')[0]}`,
            transformation: mimetype.startsWith('image/')
              ? [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }]
              : [],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        )
        .end(buffer);
    });

    const fileRecord = await prisma.file.create({
      data: {
        userId,
        filename: originalname,
        originalName: originalname,
        mimeType: mimetype,
        size,
        url: (uploadResult as any).secure_url,
        publicId: (uploadResult as any).public_id,
        resourceType: (uploadResult as any).resource_type,
      },
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        id: fileRecord.id,
        filename: fileRecord.filename,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        url: fileRecord.url,
        resourceType: fileRecord.resourceType,
        createdAt: fileRecord.createdAt,
      },
    });
  } catch (error) {
    logger.error('File upload error:', error);
    return res.status(500).json({
      error: 'Failed to upload file',
    });
  }
};

export const uploadMultipleFiles = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
      });
    }

    const uploadPromises = files.map(async file => {
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: 'auto',
              folder: `uploads/${userId}`,
              public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
              transformation: file.mimetype.startsWith('image/')
                ? [
                    {
                      width: 1920,
                      height: 1080,
                      crop: 'limit',
                      quality: 'auto',
                    },
                  ]
                : [],
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          )
          .end(file.buffer);
      });

      return {
        file,
        uploadResult,
      };
    });

    const uploadResults = await Promise.all(uploadPromises);

    const fileRecords = await prisma.$transaction(
      uploadResults.map(({ file, uploadResult }) =>
        prisma.file.create({
          data: {
            userId,
            filename: file.originalname,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: (uploadResult as any).secure_url,
            publicId: (uploadResult as any).public_id,
            resourceType: (uploadResult as any).resource_type,
          },
        })
      )
    );

    res.status(201).json({
      success: true,
      message: `${files.length} files uploaded successfully`,
      data: fileRecords.map(record => ({
        id: record.id,
        filename: record.filename,
        originalName: record.originalName,
        mimeType: record.mimeType,
        size: record.size,
        url: record.url,
        resourceType: record.resourceType,
        createdAt: record.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Multiple files upload error:', error);
    return res.status(500).json({
      error: 'Failed to upload files',
    });
  }
};

export const getUserFiles = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 10, resourceType } = req.query;

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { userId };

    if (resourceType) {
      where.resourceType = resourceType;
    }

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
          size: true,
          url: true,
          resourceType: true,
          createdAt: true,
        },
      }),
      prisma.file.count({ where }),
    ]);

    res.json({
      success: true,
      data: files,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get user files error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve files',
    });
  }
};

export const deleteFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
      });
    }

    const file = await prisma.file.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!file) {
      return res.status(404).json({
        error: 'File not found',
      });
    }

    await cloudinary.uploader.destroy(file.publicId, {
      resource_type: file.resourceType,
    });

    await prisma.file.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    logger.error('Delete file error:', error);
    return res.status(500).json({
      error: 'Failed to delete file',
    });
  }
};

/*
 * SWAGGER API DOCUMENTATION
 * =========================
 *
 * Upload file
 * @swagger
 * tags:
 *   - Files
 * summary: Upload file
 * description: Upload a single file to cloud storage
 * security:
 *   - bearerAuth: []
 * requestBody:
 *   required: true
 *   content:
 *     multipart/form-data:
 *       schema:
 *         type: object
 *         properties:
 *           file:
 *             type: string
 *             format: binary
 *             description: File to upload
 * responses:
 *   201:
 *     description: File uploaded successfully
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             message:
 *               type: string
 *             data:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 filename:
 *                   type: string
 *                 originalName:
 *                   type: string
 *                 mimeType:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 url:
 *                   type: string
 *                 resourceType:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *   400:
 *     description: Bad request - No file provided
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
 * Upload multiple files
 * @swagger
 * tags:
 *   - Files
 * summary: Upload multiple files
 * description: Upload multiple files to cloud storage
 * security:
 *   - bearerAuth: []
 * requestBody:
 *   required: true
 *   content:
 *     multipart/form-data:
 *       schema:
 *         type: object
 *         properties:
 *           files:
 *             type: array
 *             items:
 *               type: string
 *               format: binary
 *             description: Files to upload
 * responses:
 *   201:
 *     description: Files uploaded successfully
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             message:
 *               type: string
 *             data:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   filename:
 *                     type: string
 *                   originalName:
 *                     type: string
 *                   mimeType:
 *                     type: string
 *                   size:
 *                     type: integer
 *                   url:
 *                     type: string
 *                   resourceType:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *   400:
 *     description: Bad request - No files provided
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
 * Get user files
 * @swagger
 * tags:
 *   - Files
 * summary: Get user files
 * description: Retrieve paginated list of user's uploaded files
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: query
 *     name: page
 *     schema:
 *       type: integer
 *       default: 1
 *     description: Page number
 *   - in: query
 *     name: limit
 *     schema:
 *       type: integer
 *       default: 10
 *     description: Number of results per page
 *   - in: query
 *     name: resourceType
 *     schema:
 *       type: string
 *     description: Filter by resource type (image, video, etc.)
 * responses:
 *   200:
 *     description: Files retrieved successfully
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             data:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   filename:
 *                     type: string
 *                   originalName:
 *                     type: string
 *                   mimeType:
 *                     type: string
 *                   size:
 *                     type: integer
 *                   url:
 *                     type: string
 *                   resourceType:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *   401:
 *     description: Unauthorized - No valid token provided
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */

/*
 * Delete file
 * @swagger
 * tags:
 *   - Files
 * summary: Delete file
 * description: Delete a file by ID (owner only)
 * security:
 *   - bearerAuth: []
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: File ID
 * responses:
 *   200:
 *     description: File deleted successfully
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             message:
 *               type: string
 *   401:
 *     description: Unauthorized - No valid token provided
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 *   404:
 *     description: File not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/Error'
 */
