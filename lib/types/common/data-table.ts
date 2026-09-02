import type { ReactNode } from 'react';

// ===== UI Component Types =====

/**
 * Filter option for DataTableFilter dropdown
 */
export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Column definition for DataTable
 */
export interface ColumnDef<T> {
  /** Unique identifier for the column */
  key: string;
  /** Display header text */
  header: string;
  /** Property key or accessor function to get cell value */
  accessor?: keyof T | ((row: T) => unknown);
  /** Custom cell renderer */
  cell?: (row: T) => ReactNode;
  /** Column width */
  width?: number | string;
  /** Minimum desktop width when cell content must remain legible */
  minWidth?: number | string;
  /** Semantic column kind. Action cells suppress row-level activation. */
  kind?: 'data' | 'action';
  /** Whether the column is sortable */
  sortable?: boolean;
}
