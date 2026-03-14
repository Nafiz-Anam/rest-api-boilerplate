import path from 'path';
import fs from 'fs';

/**
 * Prevents creation of .mb files unless explicitly requested
 */
export const preventMbFileCreation = (filePath: string): boolean => {

  // Check if the file is a metadata file
  const isMetadataFile = path.basename(filePath).toLowerCase() === '.mb';

  return isMetadataFile;

};

/**
 * Validates file operations to prevent accidental .mb file creation
 */
export const validateFileOperation = (filePath: string, operation: 'create' | 'write'): boolean => {

  if (preventMbFileCreation(filePath)) {

    console.warn(`⚠️  Blocked ${operation} of metadata file: ${filePath}`);
    return false;

  }

  return true;

};

/**
 * Middleware to prevent .mb file creation in file operations
 */
export const fileGuard = (req: any, res: any, next: any) => {

  const originalWriteFile = fs.writeFileSync;

  fs.writeFileSync = (filePath: string, data: string | Uint8Array, options?: any) => {

    if (!validateFileOperation(filePath, 'write')) {

      throw new Error(`Creating .mb files is not allowed: ${filePath}`);

    }
    return originalWriteFile(filePath, data, options);

  };

  next();

};

export default {
  preventMbFileCreation,
  validateFileOperation,
  fileGuard
};
