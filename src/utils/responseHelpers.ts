import { Response } from 'express';

import type { PaginationMeta } from '@/types/pagination';

function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

function sendCreated<T>(res: Response, data: T): void {
  res.status(201).json({ success: true, data });
}

function sendNoContent(res: Response): void {
  res.status(204).send();
}

function sendPaginated<T>(res: Response, data: T[], meta: PaginationMeta): void {
  res.status(200).json({ success: true, data, meta });
}

export { sendCreated, sendNoContent, sendPaginated, sendSuccess };
