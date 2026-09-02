/**
 * Server DataTable Pagination - Link-based navigation for Server Components.
 *
 * Uses Next.js client navigation for SSR-backed pagination updates without
 * remounting the entire app shell.
 */

import { getTranslations } from 'next-intl/server';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { buildPaginationUrl } from '@/lib/utils/table-url';
import { ServerDataTablePaginationView } from './ServerDataTablePaginationView';

export interface ServerDataTablePaginationProps {
  /** Unique namespace for URL params (e.g., 'artists', 'posts') */
  namespace: string;
  /** Paginated query result from server */
  result: PaginatedQueryResult<unknown>;
  /** Current URL search params */
  searchParams: URLSearchParams;
  /** Base path for URL building (defaults to current path) */
  basePath?: string;
  /** Reserve footer space even when pagination controls are hidden. */
  reserveSpaceWhenHidden?: boolean;
}

export async function ServerDataTablePagination({
  namespace,
  result,
  searchParams,
  basePath = '',
  reserveSpaceWhenHidden = false,
}: ServerDataTablePaginationProps) {
  const t = await getTranslations('dataTable.pagination');

  return (
    <ServerDataTablePaginationView
      currentPage={result.page}
      totalPages={result.totalPages}
      getPageUrl={(page) => buildPaginationUrl(namespace, searchParams, page, basePath)}
      labels={{
        firstPage: t('firstPage'),
        previousPage: t('previousPage'),
        page: (page) => t('page', { page }),
        nextPage: t('nextPage'),
        lastPage: t('lastPage'),
      }}
      reserveSpaceWhenHidden={reserveSpaceWhenHidden}
    />
  );
}
