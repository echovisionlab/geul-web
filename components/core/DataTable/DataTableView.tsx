'use client';

import {
  useCallback,
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Box, Group, Stack, Table, Text } from '@mantine/core';
import { Checkbox } from '../Input';
import { TextButton } from '../TextButton';
import {
  DEFAULT_DESKTOP_TABLE_MIN_WIDTH_PX,
  getReservedTableContentMinHeight,
  getTableLoadingMinHeight,
} from './layout';
import type { DataTableRowSelectionState } from './selection';
import classes from './DataTableView.module.css';

const sortableHeaderButtonStyle: CSSProperties = {
  width: '100%',
  border: 0,
  background: 'transparent',
  padding: 0,
  margin: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
};

export type DataTableViewSortDirection = 'asc' | 'desc';

export interface DataTableViewSortState {
  ariaLabel: string;
  description?: string;
  direction?: DataTableViewSortDirection;
  order?: number;
  showOrder?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export interface DataTableViewColumn<T> {
  key: string;
  header: string;
  renderCell: (row: T) => ReactNode;
  width?: number | string;
  minWidth?: number | string;
  kind?: 'data' | 'action';
  sort?: DataTableViewSortState;
}

export interface DataTableViewRowActionBase<T> {
  onActivate: (row: T) => void;
  getAccessibleLabel: (row: T) => string;
}

export type DataTableViewRowAction<T> =
  | (DataTableViewRowActionBase<T> & { getHref: (row: T) => string })
  | (DataTableViewRowActionBase<T> & { getHref?: never });

export interface DataTableViewSelection<T> extends DataTableRowSelectionState<T> {
  selectAllRowsLabel: string;
  isRowSelectable?: (row: T) => boolean;
}

export interface DataTableViewRowInteraction<T> {
  isSelected?: (row: T) => boolean;
  isDisabled?: (row: T) => boolean;
  isDimmed?: (row: T) => boolean;
  preventTextSelection?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>, row: T, index: number) => void;
  onDoubleClick?: (event: MouseEvent<HTMLElement>, row: T, index: number) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>, row: T, index: number) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>, row: T, index: number) => void;
}

export interface DataTableViewProps<T> {
  columns: DataTableViewColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  emptyMessage: ReactNode;
  loading?: boolean;
  loadingContent?: ReactNode;
  highlightOnHover?: boolean;
  rowAction?: DataTableViewRowAction<T>;
  selection?: DataTableViewSelection<T>;
  rowInteraction?: DataTableViewRowInteraction<T>;
  desktopMinWidth?: CSSProperties['minWidth'];
  selectionCellVerticalAlign?: CSSProperties['verticalAlign'];
  reservedRowCount?: number;
  rootRef?: Ref<HTMLDivElement>;
}

interface RowActionControlProps<T> {
  row: T;
  rowKey: string;
  rowAction: DataTableViewRowAction<T>;
  disabled?: boolean;
}

function hasModifierKey(event: Pick<MouseEvent<HTMLElement>, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>) {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function RowActionControl<T>({ row, rowKey, rowAction, disabled = false }: RowActionControlProps<T>) {
  const label = rowAction.getAccessibleLabel(row);
  const href = rowAction.getHref?.(row);

  if (href && !disabled) {
    return (
      <a
        href={href}
        className={classes.rowActionControl}
        data-datatable-row-action-control={rowKey}
        onClick={(event) => {
          event.stopPropagation();
          if (event.defaultPrevented || event.button !== 0 || hasModifierKey(event)) {
            return;
          }

          event.preventDefault();
          rowAction.onActivate(row);
        }}
      >
        {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={classes.rowActionControl}
      data-datatable-row-action-control={rowKey}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        rowAction.onActivate(row);
      }}
    >
      {label}
    </button>
  );
}

export function DataTableView<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage,
  loading = false,
  loadingContent,
  highlightOnHover = false,
  rowAction,
  selection,
  rowInteraction,
  desktopMinWidth = DEFAULT_DESKTOP_TABLE_MIN_WIDTH_PX,
  selectionCellVerticalAlign,
  reservedRowCount,
  rootRef,
}: DataTableViewProps<T>) {
  const selectedRowKeySet = useMemo(() => new Set(selection?.selectedRowKeys ?? []), [selection?.selectedRowKeys]);
  const selectablePageRowKeys = useMemo(
    () =>
      rows
        .filter((row) => !rowInteraction?.isDisabled?.(row) && (selection?.isRowSelectable?.(row) ?? true))
        .map((row) => getRowKey(row)),
    [getRowKey, rowInteraction, rows, selection],
  );
  const selectedOnPageCount = useMemo(
    () => selectablePageRowKeys.filter((key) => selectedRowKeySet.has(key)).length,
    [selectablePageRowKeys, selectedRowKeySet],
  );
  const allOnPageSelected = selectablePageRowKeys.length > 0 && selectedOnPageCount === selectablePageRowKeys.length;
  const reservedMinHeight = getReservedTableContentMinHeight(reservedRowCount);
  const loadingMinHeight = getTableLoadingMinHeight(reservedRowCount);
  const rowActionColumnKey = columns.find((column) => column.kind !== 'action')?.key ?? columns[0]?.key;

  const toggleAllOnPage = useCallback(
    (checked: boolean) => {
      if (!selection) {
        return;
      }

      const next = new Set(selection.selectedRowKeys);
      selectablePageRowKeys.forEach((key) => next.delete(key));

      if (checked) {
        selectablePageRowKeys.forEach((key) => next.add(key));
      }

      selection.onSelectedRowKeysChange(Array.from(next));
    },
    [selectablePageRowKeys, selection],
  );

  const toggleRowSelection = useCallback(
    (rowKey: string, checked: boolean) => {
      if (!selection) {
        return;
      }

      const next = new Set(selection.selectedRowKeys);
      if (checked) {
        next.add(rowKey);
      } else {
        next.delete(rowKey);
      }
      selection.onSelectedRowKeysChange(Array.from(next));
    },
    [selection],
  );

  const activateRowFromClick = useCallback(
    (event: MouseEvent<HTMLElement>, row: T) => {
      if (!rowAction) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target !== event.currentTarget &&
        target.closest('a, button, input, select, textarea, [role="button"], [role="link"]')
      ) {
        return;
      }

      rowAction.onActivate(row);
    },
    [rowAction],
  );

  if (loading) {
    return (
      <Box
        ref={rootRef}
        data-datatable-loading
        aria-busy="true"
        style={{
          minHeight: loadingMinHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {loadingContent}
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box ref={rootRef} data-datatable-empty style={reservedMinHeight ? { minHeight: reservedMinHeight } : undefined}>
        <Text c="dimmed">{emptyMessage}</Text>
      </Box>
    );
  }

  return (
    <Box ref={rootRef} style={reservedMinHeight ? { minHeight: reservedMinHeight } : undefined}>
      <Box visibleFrom="sm" style={{ minWidth: 0 }}>
        <Box data-datatable-scroll style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Table highlightOnHover={highlightOnHover || !!rowAction} style={{ minWidth: desktopMinWidth }}>
            <Table.Thead>
              <Table.Tr>
                {selection && (
                  <Table.Th w={44} style={{ minWidth: 44 }}>
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={selectedOnPageCount > 0 && !allOnPageSelected}
                      onChange={(event) => toggleAllOnPage(event.currentTarget.checked)}
                      aria-label={selection.selectAllRowsLabel}
                    />
                  </Table.Th>
                )}
                {columns.map((column) => (
                  <Table.Th
                    key={column.key}
                    style={{ width: column.width, minWidth: column.minWidth }}
                    aria-sort={
                      column.sort
                        ? column.sort.direction === 'asc'
                          ? 'ascending'
                          : column.sort.direction === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                  >
                    {column.sort ? (
                      <TextButton
                        appearance="default"
                        size="sm"
                        fullWidth
                        className={classes.sortableHeaderButton}
                        style={sortableHeaderButtonStyle}
                        onClick={column.sort.onToggle}
                        aria-label={
                          column.sort.description
                            ? `${column.sort.ariaLabel}. ${column.sort.description}`
                            : column.sort.ariaLabel
                        }
                        disabled={column.sort.disabled}
                      >
                        <span>{column.header}</span>
                        {column.sort.direction && (
                          <Text size="xs" c="dimmed" span>
                            {column.sort.direction === 'asc' ? '↑' : '↓'}
                            {column.sort.showOrder && column.sort.order ? ` ${column.sort.order}` : ''}
                          </Text>
                        )}
                      </TextButton>
                    ) : (
                      <span>{column.header}</span>
                    )}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => {
                const rowKey = getRowKey(row);
                const selected = rowInteraction?.isSelected?.(row) ?? false;
                const disabled = rowInteraction?.isDisabled?.(row) ?? false;
                const dimmed = rowInteraction?.isDimmed?.(row) ?? false;
                const selectable = selection?.isRowSelectable?.(row) ?? true;
                return (
                  <Table.Tr
                    key={rowKey}
                    className={[
                      rowAction ? classes.rowWithAction : '',
                      disabled ? classes.disabledRow : '',
                      dimmed ? classes.dimmedRow : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      rowAction || rowInteraction
                        ? {
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            userSelect: rowInteraction?.preventTextSelection ? 'none' : undefined,
                          }
                        : undefined
                    }
                    tabIndex={rowInteraction ? 0 : undefined}
                    data-selected={selected || undefined}
                    data-disabled={disabled || undefined}
                    aria-disabled={disabled || undefined}
                    onClick={
                      rowAction || rowInteraction?.onClick
                        ? (event) => {
                            if (disabled) {
                              event.preventDefault();
                              return;
                            }
                            rowInteraction?.onClick?.(event, row, index);
                            if (!event.defaultPrevented && rowAction) {
                              activateRowFromClick(event, row);
                            }
                          }
                        : undefined
                    }
                    onDoubleClick={
                      rowInteraction?.onDoubleClick
                        ? (event) => !disabled && rowInteraction.onDoubleClick?.(event, row, index)
                        : undefined
                    }
                    onContextMenu={
                      rowInteraction?.onContextMenu
                        ? (event) => !disabled && rowInteraction.onContextMenu?.(event, row, index)
                        : undefined
                    }
                    onKeyDown={
                      rowInteraction?.onKeyDown
                        ? (event) => !disabled && rowInteraction.onKeyDown?.(event, row, index)
                        : undefined
                    }
                    data-datatable-desktop-row={rowKey}
                  >
                    {selection && (
                      <Table.Td
                        onClick={(event) => event.stopPropagation()}
                        style={{ width: 44, minWidth: 44, verticalAlign: selectionCellVerticalAlign }}
                      >
                        <Checkbox
                          checked={selectedRowKeySet.has(rowKey)}
                          disabled={disabled || !selectable}
                          onChange={(event) => toggleRowSelection(rowKey, event.currentTarget.checked)}
                          aria-label={selection.getRowLabel?.(row)}
                        />
                      </Table.Td>
                    )}
                    {columns.map((column) => {
                      const isActionColumn = column.kind === 'action';
                      return (
                        <Table.Td
                          key={column.key}
                          data-datatable-action-cell={isActionColumn ? '' : undefined}
                          style={{ width: column.width, minWidth: column.minWidth }}
                          onClick={isActionColumn ? (event) => event.stopPropagation() : undefined}
                          onKeyDown={isActionColumn ? (event) => event.stopPropagation() : undefined}
                        >
                          {rowAction && column.key === rowActionColumnKey ? (
                            <RowActionControl row={row} rowKey={rowKey} rowAction={rowAction} disabled={disabled} />
                          ) : null}
                          {column.renderCell(row)}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>
      </Box>

      <Stack hiddenFrom="sm" gap={0}>
        {rows.map((row, index) => {
          const rowKey = getRowKey(row);
          const disabled = rowInteraction?.isDisabled?.(row) ?? false;
          const dimmed = rowInteraction?.isDimmed?.(row) ?? false;
          const selectable = selection?.isRowSelectable?.(row) ?? true;
          const dataColumns = columns.filter((column) => column.kind !== 'action');
          const primaryColumn = dataColumns.find((column) => column.header.trim().length > 0) ?? dataColumns[0] ?? null;
          const leadingColumns = dataColumns.filter(
            (column) => column !== primaryColumn && column.header.trim().length === 0,
          );
          const detailColumns = dataColumns.filter(
            (column) => column !== primaryColumn && column.header.trim().length > 0,
          );
          const actionColumns = columns.filter((column) => column.kind === 'action');

          return (
            <Box
              key={rowKey}
              py="sm"
              className={[
                rowAction ? classes.rowWithAction : '',
                disabled ? classes.disabledRow : '',
                dimmed ? classes.dimmedRow : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                cursor: rowAction || rowInteraction ? (disabled ? 'not-allowed' : 'pointer') : undefined,
                borderBottom: index < rows.length - 1 ? '1px solid var(--mantine-color-default-border)' : undefined,
                userSelect: rowInteraction?.preventTextSelection ? 'none' : undefined,
              }}
              tabIndex={rowInteraction ? 0 : undefined}
              data-selected={rowInteraction?.isSelected?.(row) || undefined}
              data-disabled={disabled || undefined}
              aria-disabled={disabled || undefined}
              onClick={
                rowAction || rowInteraction?.onClick
                  ? (event) => {
                      if (disabled) {
                        event.preventDefault();
                        return;
                      }
                      rowInteraction?.onClick?.(event, row, index);
                      if (!event.defaultPrevented && rowAction) {
                        activateRowFromClick(event, row);
                      }
                    }
                  : undefined
              }
              onDoubleClick={
                rowInteraction?.onDoubleClick
                  ? (event) => !disabled && rowInteraction.onDoubleClick?.(event, row, index)
                  : undefined
              }
              onContextMenu={
                rowInteraction?.onContextMenu
                  ? (event) => !disabled && rowInteraction.onContextMenu?.(event, row, index)
                  : undefined
              }
              onKeyDown={
                rowInteraction?.onKeyDown
                  ? (event) => !disabled && rowInteraction.onKeyDown?.(event, row, index)
                  : undefined
              }
              data-datatable-mobile-row={rowKey}
            >
              <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    {selection && (
                      <Box onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedRowKeySet.has(rowKey)}
                          disabled={disabled || !selectable}
                          onChange={(event) => toggleRowSelection(rowKey, event.currentTarget.checked)}
                          aria-label={selection.getRowLabel?.(row)}
                        />
                      </Box>
                    )}
                    {leadingColumns.map((column) => (
                      <Box key={column.key}>{column.renderCell(row)}</Box>
                    ))}
                    <Box data-datatable-primary-cell style={{ flex: 1, minWidth: 0 }}>
                      {rowAction ? (
                        <RowActionControl row={row} rowKey={rowKey} rowAction={rowAction} disabled={disabled} />
                      ) : null}
                      {primaryColumn ? primaryColumn.renderCell(row) : null}
                    </Box>
                  </Group>
                </Box>
                {actionColumns.length > 0 && (
                  <Group
                    data-datatable-action-cell
                    gap={4}
                    align="flex-start"
                    wrap="nowrap"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {actionColumns.map((column) => (
                      <Box key={column.key}>{column.renderCell(row)}</Box>
                    ))}
                  </Group>
                )}
              </Group>

              {detailColumns.length > 0 && (
                <Group gap="xs" wrap="wrap" mt="xs">
                  {detailColumns.map((column) => (
                    <Group key={column.key} gap={4} wrap="nowrap" align="center">
                      <Text size="xs" c="dimmed" span>
                        {column.header}:
                      </Text>
                      <Box>{column.renderCell(row)}</Box>
                    </Group>
                  ))}
                </Group>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
