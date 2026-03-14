import {Router} from 'express';
import {authenticateToken} from '../middleware/auth';
import {upload, validateFiles, processImage} from '../middleware/upload';
import {
  uploadFile,
  uploadMultipleFiles,
  getUserFiles,
  deleteFile
} from '../controllers/fileController';

const router = Router();

router.use(authenticateToken);

router.post(
  '/upload',
  upload.single('file'),
  validateFiles(1),
  processImage,
  uploadFile
);

router.post(
  '/upload-multiple',
  upload.array('files', 5),
  validateFiles(5),
  uploadMultipleFiles
);

router.get('/', getUserFiles);

router.delete('/:id', deleteFile);

export default router;
