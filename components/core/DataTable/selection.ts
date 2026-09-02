'use client';

import { useEffect, useMemo, useState } from 'react';

export interface DataTableRowSelectionState<T> {
  selectedRowKeys: string[];
  onSelectedRowKeysChange: (keys: string[]) => void;
  getRowLabel?: (row: T) => string;
}

export interface CurrentPageRowSelectionResult<T> extends DataTableRowSelectionState<T> {
  clearSelection: () => void;
  currentPageRowCount: number;
  selectedOnPageRowKeys: string[];
  selectedOnPageCount: number;
  allOnPageSelected: boolean;
  someOnPageSelected: boolean;
}

export function useCurrentPageRowSelection<T>(
  rows: T[] | undefined,
  getRowKey: (row: T) => string,
  getRowLabel?: (row: T) => string,
): CurrentPageRowSelectionResult<T> {
  const rowKeys = useMemo(() => (rows ?? []).map((row) => getRowKey(row)), [getRowKey, rows]);
  const rowKeySignature = useMemo(() => rowKeys.join('\u0000'), [rowKeys]);
  const stableRowKeySet = useMemo(() => new Set(rowKeys), [rowKeySignature]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  useEffect(() => {
    setSelectedRowKeys((previous) => {
      const next = previous.filter((key) => stableRowKeySet.has(key));
      if (next.length === previous.length && next.every((key, index) => key === previous[index])) {
        return previous;
      }
      return next;
    });
  }, [rowKeySignature, stableRowKeySet]);

  const selectedKeySet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);
  const selectedOnPageRowKeys = useMemo(
    () => rowKeys.filter((key) => selectedKeySet.has(key)),
    [rowKeys, selectedKeySet],
  );
  const selectedOnPageCount = selectedOnPageRowKeys.length;

  return {
    selectedRowKeys,
    onSelectedRowKeysChange: setSelectedRowKeys,
    getRowLabel,
    clearSelection: () => setSelectedRowKeys([]),
    currentPageRowCount: rowKeys.length,
    selectedOnPageRowKeys,
    selectedOnPageCount,
    allOnPageSelected: rowKeys.length > 0 && selectedOnPageCount === rowKeys.length,
    someOnPageSelected: selectedOnPageCount > 0 && selectedOnPageCount < rowKeys.length,
  };
}
