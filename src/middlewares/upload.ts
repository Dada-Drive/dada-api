import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { Request } from 'express';
import multer, { FileFilterCallback, StorageEngine } from 'multer';

import { config } from '@/config/index';
import { UPLOAD_CONFIG } from '@/config/uploadConfig';
import { detectMimeFromBuffer } from '@/utils/fileValidation';

// ── Storage engines ─────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDiskStorage(subfolder: string): StorageEngine {
  return multer.diskStorage({
    destination(_req: Request, _file, cb) {
      const dir = path.join(UPLOAD_CONFIG.UPLOAD_DIR, subfolder);
      ensureDir(dir);
      cb(null, dir);
    },
    filename(_req: Request, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

function getStorage(subfolder: string): StorageEngine {
  if (config.upload.storage === 'local') {
    return createDiskStorage(subfolder);
  }
  // S3/Cloudinary: use memory storage — uploadService streams the buffer
  return multer.memoryStorage();
}

// ── File filter (magic bytes) ───────────────────────────────────────────────

function imageFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  // Check declared MIME type first (fast reject)
  if (!UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    return;
  }
  cb(null, true);
}

// Post-upload magic byte validation (called in uploadService)
function validateUploadedFile(file: Express.Multer.File): boolean {
  if (file.buffer) {
    // Memory storage — buffer available
    return detectMimeFromBuffer(file.buffer) !== null;
  }
  if (file.path) {
    // Disk storage — read first 12 bytes
    const fd = fs.openSync(file.path, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    return detectMimeFromBuffer(buf) !== null;
  }
  return false;
}

// ── Multer instances ────────────────────────────────────────────────────────

const avatarUpload = multer({
  storage: getStorage('avatars'),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: imageFileFilter,
}).single('avatar');

const documentUpload = multer({
  storage: getStorage('documents'),
  limits: { fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE, files: 4 },
  fileFilter: imageFileFilter,
}).array('documents', 4);

const vehiclePhotoUpload = multer({
  storage: getStorage('vehicles'),
  limits: { fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE, files: 3 },
  fileFilter: imageFileFilter,
}).array('photos', 3);

export { avatarUpload, documentUpload, validateUploadedFile, vehiclePhotoUpload };
