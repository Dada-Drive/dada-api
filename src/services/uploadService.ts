import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { config } from '@/config/index';
import { UPLOAD_CONFIG } from '@/config/uploadConfig';
import { validateUploadedFile } from '@/middlewares/upload';
import { ErrorCodes, appError } from '@/types/errorCodes';

interface UploadResult {
  url: string;
  key: string;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getExtension(mimetype: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return map[mimetype] || '.jpg';
}

async function uploadImage(file: Express.Multer.File, folder: string): Promise<UploadResult> {
  if (!validateUploadedFile(file)) {
    // Clean up invalid file from disk if it was saved
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw appError(ErrorCodes.UPLOAD.UPLOAD_INVALID_TYPE);
  }

  if (config.upload.storage === 'local') {
    // Disk storage — file already written by multer
    if (file.path) {
      const key = `${folder}/${path.basename(file.path)}`;
      return { url: `/uploads/${key}`, key };
    }
    // Memory storage fallback for local — write buffer to disk
    const dir = path.join(UPLOAD_CONFIG.UPLOAD_DIR, folder);
    ensureDir(dir);
    const filename = `${crypto.randomUUID()}${getExtension(file.mimetype)}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, file.buffer);
    const key = `${folder}/${filename}`;
    return { url: `/uploads/${key}`, key };
  }

  // S3 and Cloudinary stubs
  throw appError(ErrorCodes.GENERAL.INTERNAL_ERROR, {
    reason: `Storage provider "${config.upload.storage}" is not configured`,
  });
}

async function uploadImages(files: Express.Multer.File[], folder: string): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (const file of files) {
    results.push(await uploadImage(file, folder));
  }
  return results;
}

async function deleteImage(key: string): Promise<void> {
  if (config.upload.storage === 'local') {
    const filePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  throw appError(ErrorCodes.GENERAL.INTERNAL_ERROR, {
    reason: `Storage provider "${config.upload.storage}" is not configured`,
  });
}

export { deleteImage, uploadImage, uploadImages };
export type { UploadResult };
