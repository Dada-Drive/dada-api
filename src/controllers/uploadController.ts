import { Request, Response } from 'express';

import * as uploadService from '@/services/uploadService';
import { ErrorCodes, appError } from '@/types/errorCodes';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendCreated } from '@/utils/responseHelpers';

// ── Upload Avatar ───────────────────────────────────────────────────────────

const uploadAvatar = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    throw appError(ErrorCodes.GENERAL.VALIDATION_ERROR, {
      field: 'avatar',
      message: 'File is required',
    });
  }

  const result = await uploadService.uploadImage(req.file, 'avatars');
  sendCreated(res, result);
});

// ── Upload Documents ────────────────────────────────────────────────────────

const uploadDocuments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw appError(ErrorCodes.GENERAL.VALIDATION_ERROR, {
      field: 'documents',
      message: 'At least one file is required',
    });
  }

  const results = await uploadService.uploadImages(files, 'documents');
  sendCreated(res, results);
});

// ── Upload Vehicle Photos ───────────────────────────────────────────────────

const uploadVehiclePhotos = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw appError(ErrorCodes.GENERAL.VALIDATION_ERROR, {
      field: 'photos',
      message: 'At least one file is required',
    });
  }

  const results = await uploadService.uploadImages(files, 'vehicles');
  sendCreated(res, results);
});

export { uploadAvatar, uploadDocuments, uploadVehiclePhotos };
