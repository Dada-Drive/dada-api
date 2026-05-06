import { parsePagination } from '@/types/pagination';

import type { PaginatedQueryOptions, PaginationMeta, PaginationQuery } from '@/types/pagination';

function parsePaginationQuery(
  query: Record<string, unknown>,
): PaginatedQueryOptions & { page: number } {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const opts = parsePagination({ page, limit } as PaginationQuery);
  return { ...opts, page: Math.max(1, page) };
}

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

export { buildPaginationMeta, parsePaginationQuery };
