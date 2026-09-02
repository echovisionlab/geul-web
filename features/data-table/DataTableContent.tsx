'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DataTableView } from '@/components/core/DataTable';
import { PageLoader } from '@/features/site/PageLoader';
import { useDataTableContext } from './DataTableContext';
import {
  areDataTableSortConfigsEqual,
  createDataTableViewColumns,
  cycleDataTableSorts,
  DEFAULT_DATA_TABLE_MAX_SORTS,
  parseDataTableMaxSorts,
  parseDataTableSortConfig,
  type DataTableSortFieldConfig,
} from './content-view-model';

export interface DataTableContentProps {
  reservedRowCount?: number;
}

export function DataTableContent<T>({ reservedRowCount }: DataTableContentProps = {}) {
  const t = useTranslations('dataTable');
  const tCommonLabels = useTranslations('common.labels');
  const { columns, result, loading, query, getRowKey, rowAction, onQueryChange, emptyMessage, selection } =
    useDataTableContext<T>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState<DataTableSortFieldConfig[]>([]);
  const [maxSorts, setMaxSorts] = useState(DEFAULT_DATA_TABLE_MAX_SORTS);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const tableRoot = container.closest('[data-datatable-root]');
    if (!tableRoot) {
      return;
    }

    const syncSortConfig = () => {
      const nextSortConfig = parseDataTableSortConfig(tableRoot.getAttribute('data-sort-config'));
      const nextMaxSorts = parseDataTableMaxSorts(tableRoot.getAttribute('data-sort-max'));

      setSortConfig((previous) => (areDataTableSortConfigsEqual(previous, nextSortConfig) ? previous : nextSortConfig));
      setMaxSorts((previous) => (previous === nextMaxSorts ? previous : nextMaxSorts));
    };

    syncSortConfig();

    const observer = new MutationObserver(syncSortConfig);
    observer.observe(tableRoot, {
      attributes: true,
      attributeFilter: ['data-sort-config', 'data-sort-max'],
    });

    return () => observer.disconnect();
  }, []);

  const currentSorts = query.sorts ?? [];
  const supportedSortFields = useMemo(() => new Set(sortConfig.map((item) => item.field)), [sortConfig]);

  const handleHeaderClick = useCallback(
    (field: string) => {
      const nextSorts = cycleDataTableSorts({
        field,
        currentSorts,
        supportedSortFields,
        maxSorts,
      });
      if (!nextSorts) {
        return;
      }

      onQueryChange({
        ...query,
        sorts: nextSorts.length > 0 ? nextSorts : undefined,
        page: 1,
      });
    },
    [currentSorts, maxSorts, onQueryChange, query, supportedSortFields],
  );

  const viewColumns = useMemo(
    () =>
      createDataTableViewColumns({
        columns,
        currentSorts,
        sortConfig,
        getSortAriaLabel: (columnLabel) => t('aria.sortBy', { label: columnLabel }),
        getSortPriorityLabel: (priority, total) => `${tCommonLabels('priority')} ${priority}/${total}`,
        onSort: handleHeaderClick,
      }),
    [columns, currentSorts, handleHeaderClick, sortConfig, t, tCommonLabels],
  );

  return (
    <DataTableView
      rootRef={containerRef}
      columns={viewColumns}
      rows={result?.data ?? []}
      getRowKey={getRowKey}
      emptyMessage={emptyMessage}
      loading={loading}
      loadingContent={<PageLoader minHeight={0} />}
      rowAction={rowAction}
      selection={
        selection
          ? {
              ...selection,
              selectAllRowsLabel: 'Select all rows',
            }
          : undefined
      }
      selectionCellVerticalAlign="top"
      reservedRowCount={reservedRowCount}
    />
  );
}
