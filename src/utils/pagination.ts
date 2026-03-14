import { Request, Response, NextFunction } from 'express';

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SortOptions {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// Pagination middleware
export const paginate = (defaultLimit: number = 10, maxLimit: number = 100) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      maxLimit,
      Math.max(1, parseInt(req.query.limit as string) || defaultLimit)
    );
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    req.pagination = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    next();
  };
};

// Calculate pagination metadata
export const calculatePagination = (
  page: number,
  limit: number,
  total: number
) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };
};

// Build Prisma order by clause
export const buildOrderBy = (
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  allowedFields: string[]
): any => {
  if (!allowedFields.includes(sortBy)) {
    sortBy = allowedFields[0]; // Default to first allowed field
  }

  // Handle nested fields (e.g., 'author.username')
  const fields = sortBy.split('.');
  const orderBy: any = {};

  if (fields.length === 1) {
    orderBy[fields[0]] = sortOrder;
  } else {
    // Handle nested ordering
    let current = orderBy;
    for (let i = 0; i < fields.length - 1; i++) {
      current[fields[i]] = {};
      current = current[fields[i]];
    }
    current[fields[fields.length - 1]] = sortOrder;
  }

  return orderBy;
};

// Build Prisma where clause for search
export const buildSearchWhere = (
  searchFields: string[],
  searchTerm: string
): any => {
  if (!searchTerm || searchFields.length === 0) {
    return {};
  }

  const searchConditions = searchFields.map(field => ({
    [field]: {
      contains: searchTerm,
      mode: 'insensitive' as const,
    },
  }));

  return {
    OR: searchConditions,
  };
};

// Build filter where clause
export const buildFilterWhere = (filters: Record<string, any>): any => {
  const where: any = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'boolean') {
        where[key] = value;
      } else if (Array.isArray(value)) {
        where[key] = { in: value };
      } else if (typeof value === 'string' && value.includes(',')) {
        where[key] = { in: value.split(',') };
      } else {
        where[key] = value;
      }
    }
  });

  return where;
};

// Generic pagination function for Prisma models
export const paginateResults = async <T>(
  model: any,
  options: PaginationOptions,
  where: any = {},
  include?: any,
  allowedSortFields: string[] = ['createdAt', 'updatedAt']
): Promise<PaginationResult<T>> => {
  const { page, limit, sortBy, sortOrder } = options;
  const skip = (page - 1) * limit;

  const orderBy = buildOrderBy(
    sortBy || 'createdAt',
    sortOrder || 'desc',
    allowedSortFields
  );

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      include,
      orderBy,
      skip,
      take: limit,
    }),
    model.count({ where }),
  ]);

  const pagination = calculatePagination(page, limit, total);

  return {
    data,
    pagination,
  };
};

// Advanced pagination with cursor-based pagination (for infinite scroll)
export interface CursorPaginationOptions {
  limit: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    hasPrevious: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

export const paginateWithCursor = async <T>(
  model: any,
  options: CursorPaginationOptions,
  where: any = {},
  orderBy: any = { createdAt: 'desc' }
): Promise<CursorPaginationResult<T>> => {
  const { limit, cursor, direction = 'forward' } = options;

  let whereClause = { ...where };

  if (cursor) {
    const cursorCondition =
      direction === 'forward'
        ? { createdAt: { lt: cursor } }
        : { createdAt: { gt: cursor } };

    whereClause = { ...where, ...cursorCondition };
  }

  const data = await model.findMany({
    where: whereClause,
    orderBy,
    take: limit + 1, // Take one extra to check if there are more
    include: { author: true },
  });

  const hasMore = data.length > limit;
  const hasPrevious = !!cursor;

  // Remove the extra item if exists
  if (hasMore) {
    data.pop();
  }

  // Reverse data if going backward
  if (direction === 'backward') {
    data.reverse();
  }

  const nextCursor =
    data.length > 0 ? data[data.length - 1].createdAt : undefined;
  const prevCursor = data.length > 0 ? data[0].createdAt : undefined;

  return {
    data,
    pagination: {
      hasMore,
      hasPrevious,
      nextCursor: direction === 'forward' ? nextCursor : prevCursor,
      prevCursor: direction === 'forward' ? prevCursor : nextCursor,
    },
  };
};

// Response helper for paginated results
export const sendPaginatedResponse = <T>(
  res: Response,
  result: PaginationResult<T>,
  message: string = 'Data retrieved successfully'
) => {
  const { data, pagination } = result;

  res.set({
    'X-Total-Count': pagination.total.toString(),
    'X-Page-Count': pagination.totalPages.toString(),
    'X-Current-Page': pagination.page.toString(),
    'X-Per-Page': pagination.limit.toString(),
    'X-Has-Next': pagination.hasNext.toString(),
    'X-Has-Prev': pagination.hasPrev.toString(),
  });

  res.json({
    success: true,
    message,
    data,
    pagination,
  });
};

// Utility to parse and validate pagination parameters
export const parsePaginationParams = (query: any) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = ['asc', 'desc'].includes(query.sortOrder)
    ? query.sortOrder
    : 'desc';

  return { page, limit, sortBy, sortOrder };
};

// Sort utility for arrays (client-side sorting)
export const sortArray = <T>(
  array: T[],
  sortBy: keyof T,
  sortOrder: 'asc' | 'desc' = 'asc'
): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === null || aVal === undefined)
      return sortOrder === 'asc' ? -1 : 1;
    if (bVal === null || bVal === undefined)
      return sortOrder === 'asc' ? 1 : -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }

    if (aVal instanceof Date && bVal instanceof Date) {
      return sortOrder === 'asc'
        ? aVal.getTime() - bVal.getTime()
        : bVal.getTime() - aVal.getTime();
    }

    // Fallback to string comparison
    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortOrder === 'asc'
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });
};

// Filter utility for arrays
export const filterArray = <T>(
  array: T[],
  filters: Partial<Record<keyof T, any>>
): T[] => {
  return array.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      const itemValue = item[key as keyof T];

      if (Array.isArray(value)) {
        return value.includes(itemValue);
      }

      if (typeof value === 'string' && value.includes('*')) {
        const regex = new RegExp(value.replace(/\*/g, '.*'), 'i');
        return regex.test(String(itemValue));
      }

      return itemValue === value;
    });
  });
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationOptions;
    }
  }
}
