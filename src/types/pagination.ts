interface PaginationQuery {
  page: number;
  limit: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface PaginatedQueryOptions {
  offset: number;
  limit: number;
}

function parsePagination(query: PaginationQuery): PaginatedQueryOptions {
  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));
  return { offset: (page - 1) * limit, limit };
}

export { parsePagination };
export type { PaginatedQueryOptions, PaginationMeta, PaginationQuery };
