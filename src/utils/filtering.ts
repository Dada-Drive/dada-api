import { Order, WhereOptions } from 'sequelize';

function parseFilters(query: Record<string, unknown>, allowedFields: string[]): WhereOptions {
  const where: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (query[field] !== undefined && query[field] !== '') {
      where[field] = query[field];
    }
  }
  return where as WhereOptions;
}

function parseSorting(
  sortParam: unknown,
  allowedFields: string[],
  defaultSort: Order = [['createdAt', 'DESC']],
): Order {
  if (!sortParam || typeof sortParam !== 'string') {
    return defaultSort;
  }

  const order: [string, string][] = [];
  const parts = sortParam.split(',');

  for (const part of parts) {
    const [field, direction] = part.split(':');
    if (
      field &&
      allowedFields.includes(field) &&
      direction &&
      ['asc', 'desc'].includes(direction.toLowerCase())
    ) {
      order.push([field, direction.toUpperCase()]);
    }
  }

  return order.length > 0 ? order : defaultSort;
}

function parseFieldSelection(fieldsParam: unknown, allowedFields: string[]): string[] | undefined {
  if (!fieldsParam || typeof fieldsParam !== 'string') {
    return undefined;
  }

  const requested = fieldsParam.split(',').map((f) => f.trim());
  const selected = requested.filter((f) => allowedFields.includes(f));

  if (selected.length === 0) {
    return undefined;
  }

  // Always include id
  if (!selected.includes('id')) {
    selected.unshift('id');
  }

  return selected;
}

export { parseFieldSelection, parseFilters, parseSorting };
