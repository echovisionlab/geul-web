/**
 * Server-side DataTable component for URL-based state management.
 *
 * This component is designed for Server Components and uses URL search params
 * as the source of truth for pagination, sorting, and filtering.
 *
 * @example
 * ```tsx
 * // In page.tsx (Server Component)
 * import { parseTableQuery } from '@/lib/utils/table-url';
 *
 * export default async function ArtistsPage({ searchParams }) {
 *   const params = new URLSearchParams(await searchParams);
 *   const query = parseTableQuery(params, 'artists');
 *   const result = await listArtistsAction(query);
 *
 *   return (
 *     <ServerDataTable namespace="artists">
 *       <ServerDataTable.Toolbar>
 *         <ServerDataTable.Search namespace="artists" />
 *       </ServerDataTable.Toolbar>
 *       <ServerDataTable.Content
 *         columns={columns}
 *         result={result}
 *         getRowKey={(row) => row.id}
 *       />
 *       <ServerDataTable.Pagination
 *         namespace="artists"
 *         result={result}
 *         searchParams={params}
 *       />
 *     </ServerDataTable>
 *   );
 * }
 * ```
 */

import type { ReactNode } from 'react';
import { Stack } from '@mantine/core';
import { ServerDataTableContent } from './ServerDataTableContent';
import { ServerDataTableMultiFilter } from './ServerDataTableMultiFilter';
import { ServerDataTableMultiSort } from './ServerDataTableMultiSort';
import { ServerDataTablePagination } from './ServerDataTablePagination';
import { ServerDataTableSearch } from './ServerDataTableSearch';
import { ServerDataTableToolbar } from './ServerDataTableToolbar';

// Re-export types for convenience
export type { ColumnDef } from '@/lib/types/common/data-table';
export type { PaginatedQueryResult } from '@/lib/types/repository/result';

export interface ServerDataTableProps {
  /** Unique namespace for URL params - used for data attribute */
  namespace: string;
  /** Child components */
  children?: ReactNode;
}

/**
 * Root component for Server DataTable.
 * Simple wrapper that provides consistent styling.
 * Sub-components receive their props directly for explicit data flow.
 */
function ServerDataTableRoot({ namespace, children }: ServerDataTableProps) {
  return (
    <Stack gap="md" data-datatable-root data-namespace={namespace}>
      {children}
    </Stack>
  );
}

// Compound component pattern
export const ServerDataTable = Object.assign(ServerDataTableRoot, {
  Toolbar: ServerDataTableToolbar,
  Search: ServerDataTableSearch,
  MultiSort: ServerDataTableMultiSort,
  MultiFilter: ServerDataTableMultiFilter,
  Content: ServerDataTableContent,
  Pagination: ServerDataTablePagination,
});
