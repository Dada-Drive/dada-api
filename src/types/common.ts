import type { ErrorCode } from './errorCodes';
import type { PaginationMeta } from './pagination';

interface ApiResponse<T> {
  success: true;
  data: T;
}

interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type { ApiResponse, ErrorResponse, PaginatedResponse };
