import path from 'path';

const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES_PER_REQUEST: 5,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
  UPLOAD_DIR: path.join(process.cwd(), 'uploads'),
} as const;

export { UPLOAD_CONFIG };
