import { isColumnCount, type LayoutColumnCount } from '@/components/core/Layout/layout-contract';

/** Saved content configuration crosses into the closed layout contract here. */
export function contentColumns(value: number): LayoutColumnCount {
  return isColumnCount(value) ? value : 3;
}
