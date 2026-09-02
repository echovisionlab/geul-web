const TABLE_HEADER_HEIGHT_PX = 44;
// Measured against the public table row layout (title + summary content) on dev.
// Keep this slightly conservative so suspense/loading states do not collapse upward.
const TABLE_ROW_HEIGHT_PX = 60;
const DEFAULT_TABLE_LOADING_MIN_HEIGHT_PX = 240;
export const DEFAULT_DESKTOP_TABLE_MIN_WIDTH_PX = 640;

export function getReservedTableContentMinHeight(reservedRowCount?: number): number | undefined {
  if (!Number.isFinite(reservedRowCount) || !reservedRowCount || reservedRowCount <= 0) {
    return undefined;
  }

  return TABLE_HEADER_HEIGHT_PX + Math.ceil(reservedRowCount) * TABLE_ROW_HEIGHT_PX;
}

export function getTableLoadingMinHeight(reservedRowCount?: number): number {
  return getReservedTableContentMinHeight(reservedRowCount) ?? DEFAULT_TABLE_LOADING_MIN_HEIGHT_PX;
}
