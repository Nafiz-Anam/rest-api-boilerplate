import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { fromBuffer as fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import logger from '../config/logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
];

const storage = multer.memoryStorage();

const fileFilter = async (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  try {
    const fileType = await fileTypeFromBuffer(file.buffer);

    if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      return cb(
        new Error(`File type ${fileType?.mime ?? 'unknown'} not allowed`)
      );
    }

    cb(null, true);
  } catch {
    cb(new Error('Error validating file type'));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
  fileFilter,
});

export const processImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    return next();
  }

  try {
    const processedBuffer = await sharp(req.file.buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    req.file.buffer = processedBuffer;
    req.file.mimetype = 'image/jpeg';
    req.file.originalname = req.file.originalname.replace(/\.[^/.]+$/, '.jpg');

    next();
  } catch (error) {
    logger.error('Error processing image:', error);
    return res.status(500).json({ error: 'Error processing image' });
  }
};

export const validateFiles = (maxFiles: number = 1) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const files =
      (req.files as Express.Multer.File[]) ?? [req.file].filter(Boolean);

    if (files.length > maxFiles) {
      return res.status(400).json({
        error: `Maximum ${maxFiles} file(s) allowed`,
      });
    }

    next();
  };
};
