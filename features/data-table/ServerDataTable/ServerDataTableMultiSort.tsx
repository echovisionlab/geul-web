'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { TableSortSpec } from '@/lib/utils/table-query';
import { buildSortUrl, parseTableQuery } from '@/lib/utils/table-url';
import { MultiSortView, type SortFieldConfig } from '../MultiSortView';

export type { SortFieldConfig } from '../MultiSortView';

const sortUiState = new Map<string, { opened: boolean }>();

function areSortsEqual(left: TableSortSpec[], right: TableSortSpec[]) {
  return (
    left.length === right.length &&
    left.every((sort, index) => sort.field === right[index]?.field && sort.direction === right[index]?.direction)
  );
}

export interface ServerDataTableMultiSortProps {
  namespace: string;
  fields: SortFieldConfig[];
  placeholder?: string;
  maxSorts?: number;
}

export function ServerDataTableMultiSort({
  namespace,
  fields,
  placeholder,
  maxSorts = 3,
}: ServerDataTableMultiSortProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [opened, setOpened] = useState(() => sortUiState.get(namespace)?.opened ?? false);
  const markerRef = useRef<HTMLSpanElement>(null);
  const shouldCloseAfterTransitionRef = useRef(false);
  const lastSyncedSortsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const tableRoot = markerRef.current?.closest('[data-datatable-root]');
    if (!tableRoot) {
      return;
    }
    tableRoot.setAttribute('data-sort-config', JSON.stringify(fields));
    tableRoot.setAttribute('data-sort-max', String(maxSorts));
  }, [fields, maxSorts]);

  useEffect(() => {
    sortUiState.set(namespace, { opened });
  }, [namespace, opened]);

  useEffect(() => {
    if (isPending || !shouldCloseAfterTransitionRef.current) {
      return;
    }
    shouldCloseAfterTransitionRef.current = false;
    setOpened(false);
  }, [isPending]);

  const currentSorts: TableSortSpec[] = parseTableQuery(searchParams, namespace).sorts ?? [];
  const currentSortsKey = useMemo(() => JSON.stringify(currentSorts), [currentSorts]);
  const [draftSorts, setDraftSorts] = useState<TableSortSpec[]>(currentSorts);
  const hasDraftChanges = !areSortsEqual(draftSorts, currentSorts);

  useEffect(() => {
    if (lastSyncedSortsKeyRef.current === null) {
      lastSyncedSortsKeyRef.current = currentSortsKey;
    }
  }, [currentSortsKey]);

  useEffect(() => {
    if (isPending || opened || currentSortsKey === lastSyncedSortsKeyRef.current) {
      return;
    }
    setDraftSorts(currentSorts);
    lastSyncedSortsKeyRef.current = currentSortsKey;
  }, [currentSorts, currentSortsKey, isPending, opened]);

  const toggleField = (field: string) => {
    setDraftSorts((sorts) => {
      if (sorts.some((sort) => sort.field === field)) {
        return sorts.filter((sort) => sort.field !== field);
      }
      return sorts.length < maxSorts ? [...sorts, { field, direction: 'desc' }] : sorts;
    });
  };

  const toggleDirection = (field: string) => {
    setDraftSorts((sorts) =>
      sorts.map((sort) =>
        sort.field === field
          ? { ...sort, direction: sort.direction === 'asc' ? ('desc' as const) : ('asc' as const) }
          : sort,
      ),
    );
  };

  const moveSort = (field: string, direction: 'up' | 'down') => {
    setDraftSorts((sorts) => {
      const index = sorts.findIndex((sort) => sort.field === field);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= sorts.length) {
        return sorts;
      }
      const nextSorts = [...sorts];
      const [sort] = nextSorts.splice(index, 1);
      nextSorts.splice(nextIndex, 0, sort);
      return nextSorts;
    });
  };

  const apply = () => {
    shouldCloseAfterTransitionRef.current = true;
    const url = buildSortUrl(namespace, searchParams, draftSorts.length > 0 ? draftSorts : undefined, pathname);
    startTransition(() => router.push(url, { scroll: false }));
  };

  return (
    <MultiSortView
      fields={fields}
      sorts={draftSorts}
      appliedSorts={currentSorts}
      placeholder={placeholder}
      maxSorts={maxSorts}
      opened={opened}
      markerRef={markerRef}
      disabled={isPending}
      hasChanges={hasDraftChanges}
      onOpenedChange={setOpened}
      onToggleField={toggleField}
      onToggleDirection={toggleDirection}
      onMoveSort={moveSort}
      onRemoveSort={(field) => setDraftSorts((sorts) => sorts.filter((sort) => sort.field !== field))}
      onClear={() => setDraftSorts([])}
      onApply={apply}
    />
  );
}
