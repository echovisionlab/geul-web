/**
 * Table query type definitions and schemas.
 */

import { z } from 'zod';

// ============================================================================
// Schemas
// ============================================================================

export const sortSpecSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});

export const filterSpecSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z.unknown(),
});

export const tableQuerySchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sorts: z.array(sortSpecSchema).optional(),
  filters: z.array(filterSpecSchema).optional(),
  filterBy: z.enum(['AND', 'OR']).optional(),
});

// ============================================================================
// Types
// ============================================================================

export type TableSortSpec = z.infer<typeof sortSpecSchema>;
export type TableFilterSpec = z.infer<typeof filterSpecSchema>;
export type TableQuery = z.infer<typeof tableQuerySchema>;

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
