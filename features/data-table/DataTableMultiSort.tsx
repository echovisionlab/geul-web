'use client';

import { useEffect, useRef, useState } from 'react';
import { useDataTableContext } from './DataTableContext';
import { MultiSortView, type SortFieldConfig } from './MultiSortView';

export type { SortFieldConfig } from './MultiSortView';

export interface DataTableMultiSortProps {
  fields: SortFieldConfig[];
  placeholder?: string;
  maxSorts?: number;
}

export function DataTableMultiSort({ fields, placeholder, maxSorts = 3 }: DataTableMultiSortProps) {
  const { query, onQueryChange } = useDataTableContext();
  const [opened, setOpened] = useState(false);
  const markerRef = useRef<HTMLSpanElement>(null);
  const sorts = query.sorts ?? [];

  useEffect(() => {
    const tableRoot = markerRef.current?.closest('[data-datatable-root]');
    if (!tableRoot) {
      return;
    }
    tableRoot.setAttribute('data-sort-config', JSON.stringify(fields));
    tableRoot.setAttribute('data-sort-max', String(maxSorts));
  }, [fields, maxSorts]);

  const updateSorts = (nextSorts: typeof sorts) => {
    onQueryChange({
      ...query,
      sorts: nextSorts.length > 0 ? nextSorts : undefined,
      page: 1,
    });
  };

  const toggleField = (field: string) => {
    const existing = sorts.find((sort) => sort.field === field);
    if (existing) {
      updateSorts(sorts.filter((sort) => sort.field !== field));
    } else if (sorts.length < maxSorts) {
      updateSorts([...sorts, { field, direction: 'desc' }]);
    }
  };

  const toggleDirection = (field: string) => {
    updateSorts(
      sorts.map((sort) =>
        sort.field === field
          ? { ...sort, direction: sort.direction === 'asc' ? ('desc' as const) : ('asc' as const) }
          : sort,
      ),
    );
  };

  const moveSort = (field: string, direction: 'up' | 'down') => {
    const index = sorts.findIndex((sort) => sort.field === field);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= sorts.length) {
      return;
    }
    const nextSorts = [...sorts];
    const [sort] = nextSorts.splice(index, 1);
    nextSorts.splice(nextIndex, 0, sort);
    updateSorts(nextSorts);
  };

  return (
    <MultiSortView
      fields={fields}
      sorts={sorts}
      placeholder={placeholder}
      maxSorts={maxSorts}
      opened={opened}
      markerRef={markerRef}
      onOpenedChange={setOpened}
      onToggleField={toggleField}
      onToggleDirection={toggleDirection}
      onMoveSort={moveSort}
      onRemoveSort={(field) => updateSorts(sorts.filter((sort) => sort.field !== field))}
      onClear={() => updateSorts([])}
    />
  );
}
