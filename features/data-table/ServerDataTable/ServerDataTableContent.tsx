'use client';

/**
 * Server DataTable Content - Connects URL-based table state to the Core table view.
 * The data is pre-fetched on the server, while sorting navigation remains a client controller concern.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DataTableView, type DataTableRowSelectionState } from '@/components/core/DataTable';
import { PageLoader } from '@/features/site/PageLoader';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { SortSpec } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { buildSortUrl, parseTableQuery } from '@/lib/utils/table-url';
import {
  areDataTableSortConfigsEqual,
  createDataTableViewColumns,
  cycleDataTableSorts,
  DEFAULT_DATA_TABLE_MAX_SORTS,
  parseDataTableMaxSorts,
  parseDataTableSortConfig,
  type DataTableSortFieldConfig,
} from '../content-view-model';

export interface ServerDataTableContentProps<T> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Paginated query result from server */
  result: PaginatedQueryResult<T>;
  /** Function to get unique key for each row */
  getRowKey: (row: T) => string;
  /** Message to show when no data */
  emptyMessage?: string;
  /** Whether rows should be highlighted on hover (indicates clickable) */
  highlightOnHover?: boolean;
  /** Optional current-page row selection state */
  selection?: DataTableRowSelectionState<T>;
  /** Reserve enough vertical space for this many rows even when fewer rows match. */
  reservedRowCount?: number;
  /** When false, keep stale content during navigation and rely on outer suspense fallback instead. */
  showPendingLoader?: boolean;
}

export function ServerDataTableContent<T>({
  columns,
  result,
  getRowKey,
  emptyMessage = 'No data found.',
  highlightOnHover = false,
  selection,
  reservedRowCount,
  showPendingLoader = true,
}: ServerDataTableContentProps<T>) {
  const t = useTranslations('dataTable');
  const tCommonLabels = useTranslations('common.labels');
  const containerRef = useRef<HTMLDivElement>(null);
  const [namespace, setNamespace] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<DataTableSortFieldConfig[]>([]);
  const [maxSorts, setMaxSorts] = useState(DEFAULT_DATA_TABLE_MAX_SORTS);
  const [tablePending, setTablePending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const tableRoot = container.closest('[data-datatable-root]');
    if (!tableRoot) {
      return;
    }

    const syncTableConfig = () => {
      const resolvedNamespace = tableRoot.getAttribute('data-namespace');
      const nextSortConfig = parseDataTableSortConfig(tableRoot.getAttribute('data-sort-config'));
      const nextMaxSorts = parseDataTableMaxSorts(tableRoot.getAttribute('data-sort-max'));
      const nextPending = tableRoot.getAttribute('data-pending') === 'true';

      setNamespace((previous) => (previous === (resolvedNamespace || null) ? previous : resolvedNamespace || null));
      setSortConfig((previous) => (areDataTableSortConfigsEqual(previous, nextSortConfig) ? previous : nextSortConfig));
      setMaxSorts((previous) => (previous === nextMaxSorts ? previous : nextMaxSorts));
      setTablePending((previous) => (previous === nextPending ? previous : nextPending));
    };

    syncTableConfig();

    const observer = new MutationObserver(syncTableConfig);
    observer.observe(tableRoot, {
      attributes: true,
      attributeFilter: ['data-namespace', 'data-sort-config', 'data-sort-max', 'data-pending'],
    });

    return () => observer.disconnect();
  }, []);

  const currentSorts = useMemo(() => {
    if (!namespace) {
      return [] as SortSpec[];
    }

    const currentQuery = parseTableQuery(searchParams, namespace);
    return currentQuery.sorts ?? [];
  }, [namespace, searchParams]);

  const supportedSortFields = useMemo(() => new Set(sortConfig.map((item) => item.field)), [sortConfig]);

  const handleHeaderClick = useCallback(
    (field: string) => {
      if (!namespace || isPending) {
        return;
      }

      const nextSorts = cycleDataTableSorts({
        field,
        currentSorts,
        supportedSortFields,
        maxSorts,
      });
      if (!nextSorts) {
        return;
      }

      const url = buildSortUrl(namespace, searchParams, nextSorts.length > 0 ? nextSorts : undefined, pathname);

      startTransition(() => {
        router.push(url, { scroll: false });
      });
    },
    [currentSorts, isPending, maxSorts, namespace, pathname, router, searchParams, supportedSortFields],
  );

  const viewColumns = useMemo(
    () =>
      createDataTableViewColumns({
        columns,
        currentSorts,
        sortConfig,
        sortDisabled: isPending,
        getSortAriaLabel: (columnLabel) => t('aria.sortBy', { label: columnLabel }),
        getSortPriorityLabel: (priority, total) => `${tCommonLabels('priority')} ${priority}/${total}`,
        onSort: handleHeaderClick,
      }),
    [columns, currentSorts, handleHeaderClick, isPending, sortConfig, t, tCommonLabels],
  );

  return (
    <DataTableView
      rootRef={containerRef}
      columns={viewColumns}
      rows={result.data}
      getRowKey={getRowKey}
      emptyMessage={emptyMessage}
      loading={showPendingLoader && (tablePending || isPending)}
      loadingContent={<PageLoader minHeight={0} />}
      highlightOnHover={highlightOnHover}
      selection={
        selection
          ? {
              ...selection,
              selectAllRowsLabel: 'Select all rows',
            }
          : undefined
      }
      reservedRowCount={reservedRowCount}
    />
  );
}
