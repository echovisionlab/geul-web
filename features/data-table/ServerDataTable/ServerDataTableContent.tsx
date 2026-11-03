'use client';

/**
 * Server DataTable Content - Connects URL-based table state to the Core table view.
 * The data is pre-fetched on the server, while sorting navigation remains a client controller concern.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  useServerTablePathname as usePathname,
  useServerTableRouter as useRouter,
  useServerTableSearchParams as useSearchParams,
  useServerTablePending,
} from './ServerDataTableNavigation';
import { Alert } from '@/components/core/Alert';
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
  accessibleLabel?: string;
  /** Paginated query result from server */
  result: PaginatedQueryResult<T>;
  /** Function to get unique key for each row */
  getRowKey: (row: T) => string;
  /** Message to show when no data */
  emptyMessage?: string;
  /** Whether rows should be highlighted on hover (indicates clickable) */
  highlightOnHover?: boolean;
  /** Optional current-page row selection state */
  selection?: DataTableRowSelectionState<T> & { selectAllRowsLabel?: string };
  /** Reserve enough vertical space for this many rows even when fewer rows match. */
  reservedRowCount?: number;
  /** Override navigation loading; by default retain existing rows and show the common loader only without rows. */
  showPendingLoader?: boolean;
}

export function ServerDataTableContent<T>({
  columns,
  accessibleLabel,
  result,
  getRowKey,
  emptyMessage = 'No data found.',
  highlightOnHover = false,
  selection,
  reservedRowCount,
  showPendingLoader = result.data.length === 0,
}: ServerDataTableContentProps<T>) {
  const t = useTranslations('dataTable');
  const tCommonLabels = useTranslations('common.labels');
  const containerRef = useRef<HTMLDivElement>(null);
  const [rootAccessibleLabel, setRootAccessibleLabel] = useState<string | undefined>();
  const [namespace, setNamespace] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<DataTableSortFieldConfig[]>([]);
  const [maxSorts, setMaxSorts] = useState(DEFAULT_DATA_TABLE_MAX_SORTS);
  const [tablePending, setTablePending] = useState(false);
  const [isPending, startTransition] = useTransition();
  useServerTablePending(containerRef, isPending);
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
      setRootAccessibleLabel(tableRoot.getAttribute('data-accessible-label') ?? undefined);
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
      attributeFilter: ['data-accessible-label', 'data-namespace', 'data-sort-config', 'data-sort-max', 'data-pending'],
    });

    return () => observer.disconnect();
  }, [Boolean(result.error)]);

  useEffect(() => {
    const tableRoot = containerRef.current?.closest('[data-datatable-root]');
    tableRoot?.setAttribute('aria-busy', tablePending || isPending ? 'true' : 'false');
  }, [tablePending, isPending, result.error]);

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

      startTransition(async () => {
        await router.push(url, { scroll: false });
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
        sortDisabled: isPending || tablePending,
        getSortAriaLabel: (columnLabel) => t('aria.sortBy', { label: columnLabel }),
        getSortPriorityLabel: (priority, total) => `${tCommonLabels('priority')} ${priority}/${total}`,
        getSortDirectionLabel: (direction) =>
          t(direction === 'asc' ? 'sort.aria.directionAscending' : 'sort.aria.directionDescending'),
        actionColumnLabel: tCommonLabels('actions'),
        onSort: handleHeaderClick,
      }),
    [columns, currentSorts, handleHeaderClick, isPending, tablePending, sortConfig, t, tCommonLabels],
  );

  if (result.error) {
    return (
      <div ref={containerRef} aria-busy={tablePending || isPending}>
        <Alert tone="danger" role="alert">
          {result.error}
        </Alert>
        {(tablePending || isPending) && <PageLoader placement="flow" minHeight={0} />}
      </div>
    );
  }

  return (
    <DataTableView
      rootRef={containerRef}
      accessibleLabel={accessibleLabel ?? rootAccessibleLabel}
      loadingMessage={t('aria.loadingMessage')}
      resultMessage={
        tablePending || isPending
          ? t('aria.loadingMessage')
          : t('aria.resultSummary', { count: result.total, page: result.page, totalPages: result.totalPages })
      }
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
              selectAllRowsLabel: selection.selectAllRowsLabel ?? t('aria.selectAllRows'),
            }
          : undefined
      }
      reservedRowCount={reservedRowCount}
    />
  );
}
