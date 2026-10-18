export interface SelectedPillRow {
  /** Row width left for pills; 0 when the row has not been laid out. */
  available: number;
  /** Measured width of each selected pill, in value order. */
  widths: readonly number[];
  gap: number;
  /** Width of the `+N` summary that replaces the pills that do not fit. */
  summaryWidth: number;
}

/**
 * Number of leading selected pills shown on one row: every pill when they all fit (or the row is not laid
 * out yet), otherwise as many as fit next to the overflow summary.
 */
export function countVisiblePills({ available, widths, gap, summaryWidth }: SelectedPillRow) {
  if (!available) {
    return widths.length;
  }
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1);
  if (total <= available) {
    return widths.length;
  }
  let used = summaryWidth;
  let count = 0;
  for (const pillWidth of widths) {
    if (used + gap + pillWidth > available) {
      break;
    }
    used += gap + pillWidth;
    count++;
  }
  return count;
}
