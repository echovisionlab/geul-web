'use client';
import { SupportingText, Text as DsText, VisuallyHidden as HiddenHeaderText } from '../Typography';

import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset, LayoutStack, LayoutVisibility } from '../Layout';
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Table } from '../Display';
import { VisuallyHidden } from 'react-aria-components';
import { Checkbox } from '../Input/Checkbox';
import { TextButton } from '../TextButton';
import { MetadataPair } from '../PublicMetadata';
import {
  DEFAULT_DESKTOP_TABLE_MIN_WIDTH_PX,
  getReservedTableContentMinHeight,
  getTableLoadingMinHeight,
} from './layout';
import type { DataTableRowSelectionState } from './selection';
import classes from './DataTableView.module.css';

export type DataTableViewSortDirection = 'asc' | 'desc';

export interface DataTableViewSortState {
  ariaLabel: string;
  /** Localized current direction and priority, including secondary sorts. */
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
  /** Names icon/action-only column headers without changing displayed copy. */
  accessibleLabel?: string;
  renderCell: (row: T) => ReactNode;
  width?: number | string;
  minWidth?: number | string;
  kind?: 'data' | 'action';
  align?: 'start' | 'center' | 'end';
  /** Inline mobile rows keep only explicitly useful metadata. */
  mobileVisibility?: 'visible' | 'hidden';
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
  onRowSelectionClick?: (event: MouseEvent<HTMLElement>, row: T, index: number) => void;
}

export interface DataTableViewRowInteraction<T> {
  isSelected?: (row: T) => boolean;
  isDisabled?: (row: T) => boolean;
  isDimmed?: (row: T) => boolean;
  /** Localized action constraints, separate from the displayed row name. */
  getDescription?: (row: T) => string | undefined;
  preventTextSelection?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>, row: T, index: number) => void;
  onDoubleClick?: (event: MouseEvent<HTMLElement>, row: T, index: number) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>, row: T, index: number) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>, row: T, index: number) => void;
}

export interface DataTableViewProps<T> {
  /** Names the same collection in desktop and mobile representations. */
  accessibleLabel?: string;
  /** Localized result summary. Kept separate from the table name and displayed cells. */
  resultMessage?: string;
  loadingMessage?: string;
  columns: DataTableViewColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  emptyMessage: ReactNode;
  loading?: boolean;
  loadingContent?: ReactNode;
  highlightOnHover?: boolean;
  density?: 'compact' | 'standard' | 'comfortable';
  /** Compact rows adapt to the available surface width and omit repeated metadata labels. */
  mobileLayout?: 'cards' | 'compact' | 'inline';
  /** Fixed tracks keep long content from expanding the table; the primary column fills remaining space. */
  columnSizing?: 'content' | 'fixed';
  rowDividers?: 'all' | 'between';
  rowAction?: DataTableViewRowAction<T>;
  selection?: DataTableViewSelection<T>;
  rowInteraction?: DataTableViewRowInteraction<T>;
  desktopMinWidth?: CSSProperties['minWidth'];
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

// A rendered cell may contain native or ARIA controls, including rich-text editors.
// Their own action must not also trigger the enclosing row's navigation.
/** Selection checkbox track: the touch-target token, mirrored as px for the fixed-sizing minimum width sum. */
const SELECTION_TRACK_WIDTH = 'var(--geul-interaction-touch)';
const SELECTION_TRACK_WIDTH_PX = 44;
const rowControlSelector = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  ...[
    'button',
    'link',
    'checkbox',
    'radio',
    'switch',
    'combobox',
    'slider',
    'spinbutton',
    'textbox',
    'option',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
  ].map((role) => `[role="${role}"]`),
].join(', ');

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
  accessibleLabel,
  resultMessage,
  loadingMessage,
  getRowKey,
  emptyMessage,
  loading = false,
  loadingContent,
  highlightOnHover = false,
  density = 'compact',
  mobileLayout = 'cards',
  columnSizing = 'content',
  rowDividers = 'all',
  rowAction,
  selection,
  rowInteraction,
  desktopMinWidth = DEFAULT_DESKTOP_TABLE_MIN_WIDTH_PX,
  reservedRowCount,
  rootRef,
}: DataTableViewProps<T>) {
  const descriptionPrefix = useId();
  if (columnSizing !== 'content' && columnSizing !== 'fixed') {
    throw new RangeError('Invalid data table column sizing');
  }
  if (!['cards', 'compact', 'inline'].includes(mobileLayout)) {
    throw new RangeError('Invalid data table mobile layout');
  }
  for (const column of columns) {
    if (column.mobileVisibility && !['visible', 'hidden'].includes(column.mobileVisibility)) {
      throw new RangeError('Invalid data table column mobile visibility');
    }
    if (column.align && !['start', 'center', 'end'].includes(column.align)) {
      throw new RangeError('Invalid data table column alignment');
    }
  }
  const primaryTrack = columns.find((column) => column.kind !== 'action' && column.header.trim().length > 0);
  // ARIA exposes one sorted header. Multi-sort priority is carried by each
  // control's localized description, independently of displayed column order.
  const primarySortColumn = columns.reduce<DataTableViewColumn<T> | undefined>((primary, column) => {
    if (!column.sort?.direction) {
      return primary;
    }
    if (!primary) {
      return column;
    }
    const priority = (order: number | undefined) =>
      order !== undefined && Number.isFinite(order) && order > 0 ? order : Infinity;
    return priority(column.sort.order) < priority(primary.sort?.order) ? column : primary;
  }, undefined);
  const minimumTrackWidth = columns.reduce(
    (total, column) =>
      total +
      Math.max(
        typeof column.width === 'number' ? column.width : 0,
        typeof column.minWidth === 'number' ? column.minWidth : 0,
      ),
    selection ? SELECTION_TRACK_WIDTH_PX : 0,
  );
  const tableMinWidth =
    columnSizing === 'fixed'
      ? typeof desktopMinWidth === 'number'
        ? Math.max(desktopMinWidth, minimumTrackWidth)
        : `max(${desktopMinWidth ?? '0px'}, ${minimumTrackWidth}px)`
      : desktopMinWidth;
  const rangeSelectionClickRef = useRef(false);
  const captureSelectionClick = (event: MouseEvent<HTMLElement>, row: T, index: number) => {
    rangeSelectionClickRef.current = Boolean(selection?.onRowSelectionClick && event.shiftKey);
    selection?.onRowSelectionClick?.(event, row, index);
  };
  const changeRowSelection = (rowKey: string, checked: boolean) => {
    if (rangeSelectionClickRef.current) {
      rangeSelectionClickRef.current = false;
      return;
    }
    toggleRowSelection(rowKey, checked);
  };
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
      const control = target instanceof Element ? target.closest(rowControlSelector) : null;
      if (control && control !== event.currentTarget) {
        return;
      }

      rowAction.onActivate(row);
    },
    [rowAction],
  );

  const status = (
    <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
      {loading ? loadingMessage : rows.length ? resultMessage : null}
    </VisuallyHidden>
  );

  if (loading) {
    return (
      <>
        {status}
        <div
          className={classes.loading}
          ref={rootRef}
          data-datatable-loading
          aria-busy="true"
          style={{
            minHeight: loadingMinHeight,
          }}
        >
          {loadingContent}
        </div>
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <>
        {status}
        <div
          role="status"
          aria-live="polite"
          ref={rootRef}
          data-datatable-empty
          style={reservedMinHeight ? { minHeight: reservedMinHeight } : undefined}
        >
          <SupportingText tone="secondary">{emptyMessage}</SupportingText>
        </div>
      </>
    );
  }

  return (
    <>
      {status}
      <div
        role={accessibleLabel ? 'group' : undefined}
        aria-label={accessibleLabel}
        ref={rootRef}
        className={classes.root}
        data-mobile-layout={mobileLayout}
        style={reservedMinHeight ? { minHeight: reservedMinHeight } : undefined}
      >
        <LayoutVisibility visibleFrom={mobileLayout === 'cards' ? 'sm' : undefined}>
          <div className={classes.desktop}>
            <div
              data-datatable-scroll
              className={classes.scroll}
              role={accessibleLabel ? 'region' : undefined}
              aria-label={accessibleLabel}
              tabIndex={0}
            >
              <Table
                aria-label={accessibleLabel}
                density={density}
                rowDividers={rowDividers}
                highlightOnHover={highlightOnHover || !!rowAction}
                minWidth={tableMinWidth}
                data-column-sizing={columnSizing}
              >
                {columnSizing === 'fixed' && (
                  <colgroup>
                    {selection && <col className={classes.selectionTrack} />}
                    {columns.map((column) => (
                      <col
                        key={column.key}
                        style={{ width: column.width ?? (column === primaryTrack ? undefined : column.minWidth) }}
                      />
                    ))}
                  </colgroup>
                )}
                <Table.Thead>
                  <Table.Tr>
                    {selection && (
                      <Table.Th width={SELECTION_TRACK_WIDTH} minWidth={SELECTION_TRACK_WIDTH}>
                        <div className={classes.selectionControl}>
                          <Checkbox
                            checked={allOnPageSelected}
                            indeterminate={selectedOnPageCount > 0 && !allOnPageSelected}
                            onChange={(event) => toggleAllOnPage(event.currentTarget.checked)}
                            aria-label={selection.selectAllRowsLabel}
                          />
                        </div>
                      </Table.Th>
                    )}
                    {columns.map((column, columnIndex) => (
                      <Table.Th
                        key={column.key}
                        aria-label={column.header.trim() ? undefined : column.accessibleLabel}
                        width={column.width}
                        minWidth={column.minWidth}
                        align={column.align}
                        aria-sort={
                          column === primarySortColumn
                            ? column.sort?.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        {column.sort ? (
                          <TextButton
                            appearance="default"
                            size="sm"
                            fullWidth
                            justify={column.align ?? 'start'}
                            onClick={column.sort.onToggle}
                            aria-label={column.sort.ariaLabel}
                            aria-describedby={
                              column.sort.description ? `${descriptionPrefix}-${columnIndex}` : undefined
                            }
                            disabled={column.sort.disabled}
                          >
                            <span>
                              {column.header}
                              {!column.header.trim() && column.accessibleLabel ? (
                                <HiddenHeaderText>{column.accessibleLabel}</HiddenHeaderText>
                              ) : null}
                            </span>
                            {column.sort.direction && (
                              <DsText size="xs" tone="secondary" as="span">
                                {column.sort.direction === 'asc' ? '↑' : '↓'}
                                {column.sort.showOrder && column.sort.order ? ` ${column.sort.order}` : ''}
                              </DsText>
                            )}
                            {column.sort.description ? (
                              <VisuallyHidden id={`${descriptionPrefix}-${columnIndex}`}>
                                {column.sort.description}
                              </VisuallyHidden>
                            ) : null}
                          </TextButton>
                        ) : (
                          <span>
                            {column.header}
                            {!column.header.trim() && column.accessibleLabel ? (
                              <HiddenHeaderText>{column.accessibleLabel}</HiddenHeaderText>
                            ) : null}
                          </span>
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
                    const rowDescription = rowInteraction?.getDescription?.(row)?.trim();
                    const rowDescriptionId = `${descriptionPrefix}-desktop-row-description-${index}`;
                    return (
                      <Table.Tr
                        key={rowKey}
                        interactive={!!(rowAction || rowInteraction)}
                        disabled={disabled}
                        dimmed={dimmed}
                        preventTextSelection={rowInteraction?.preventTextSelection}
                        tabIndex={rowInteraction ? 0 : undefined}
                        selected={selected}
                        data-disabled={disabled || undefined}
                        aria-disabled={disabled || undefined}
                        aria-describedby={rowDescription ? rowDescriptionId : undefined}
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
                            onClickCapture={(event) => captureSelectionClick(event, row, index)}
                            onClick={(event) => event.stopPropagation()}
                            width={SELECTION_TRACK_WIDTH}
                            minWidth={SELECTION_TRACK_WIDTH}
                          >
                            {selectable ? (
                              <div className={classes.selectionControl}>
                                <Checkbox
                                  checked={selectedRowKeySet.has(rowKey)}
                                  disabled={disabled}
                                  onChange={(event) => changeRowSelection(rowKey, event.currentTarget.checked)}
                                  aria-label={selection.getRowLabel?.(row)}
                                />
                              </div>
                            ) : null}
                          </Table.Td>
                        )}
                        {columns.map((column, columnIndex) => {
                          const isActionColumn = column.kind === 'action';
                          return (
                            <Table.Td
                              key={column.key}
                              data-datatable-action-cell={isActionColumn ? '' : undefined}
                              width={column.width}
                              minWidth={column.minWidth}
                              align={column.align}
                              onClick={isActionColumn ? (event) => event.stopPropagation() : undefined}
                              onKeyDown={isActionColumn ? (event) => event.stopPropagation() : undefined}
                            >
                              {rowAction && column.key === rowActionColumnKey ? (
                                <RowActionControl row={row} rowKey={rowKey} rowAction={rowAction} disabled={disabled} />
                              ) : null}
                              {column.renderCell(row)}
                              {rowDescription && columnIndex === 0 ? (
                                <VisuallyHidden id={rowDescriptionId}>{rowDescription}</VisuallyHidden>
                              ) : null}
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          </div>
        </LayoutVisibility>

        <LayoutVisibility hiddenFrom={mobileLayout === 'cards' ? 'sm' : undefined}>
          <div className={classes.mobile}>
            <LayoutStack gap="none">
              {rows.map((row, index) => {
                const rowKey = getRowKey(row);
                const disabled = rowInteraction?.isDisabled?.(row) ?? false;
                const dimmed = rowInteraction?.isDimmed?.(row) ?? false;
                const selectable = selection?.isRowSelectable?.(row) ?? true;
                const rowDescription = rowInteraction?.getDescription?.(row)?.trim();
                const rowDescriptionId = `${descriptionPrefix}-mobile-row-description-${index}`;
                const dataColumns = columns.filter((column) => column.kind !== 'action');
                const primaryColumn =
                  dataColumns.find((column) => column.header.trim().length > 0) ?? dataColumns[0] ?? null;
                const leadingColumns = dataColumns.filter(
                  (column) => column !== primaryColumn && column.header.trim().length === 0,
                );
                const detailColumns = dataColumns.filter(
                  (column) => column !== primaryColumn && column.header.trim().length > 0,
                );
                const inlineDetails = detailColumns.filter((column) => column.mobileVisibility !== 'hidden');
                const actionColumns = columns.filter((column) => column.kind === 'action');
                const rowNameId = `${descriptionPrefix}-mobile-row-${index}`;
                const interactionControl =
                  rowInteraction && !rowAction && (rowInteraction.onClick || rowInteraction.onKeyDown) ? (
                    <button
                      type="button"
                      className={classes.rowActionControl}
                      data-datatable-row-interaction-control={rowKey}
                      aria-labelledby={primaryColumn ? rowNameId : undefined}
                      aria-label={!primaryColumn ? selection?.getRowLabel?.(row) : undefined}
                      aria-describedby={rowDescription ? rowDescriptionId : undefined}
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!disabled) {
                          rowInteraction.onClick?.(event, row, index);
                        }
                      }}
                      onKeyDown={(event) => {
                        // Call on the actual command so consumer guards distinguish
                        // it from checkboxes, menus and custom cell controls.
                        event.stopPropagation();
                        if (!disabled) {
                          rowInteraction.onKeyDown?.(event, row, index);
                        }
                      }}
                    />
                  ) : null;

                return (
                  <div
                    key={rowKey}
                    data-density={density}
                    role={rowInteraction ? 'group' : undefined}
                    aria-labelledby={rowInteraction && primaryColumn ? rowNameId : undefined}
                    data-interactive={!!(rowAction || rowInteraction) || undefined}
                    data-prevent-selection={rowInteraction?.preventTextSelection || undefined}
                    className={[
                      classes.mobileRow,
                      rowAction || interactionControl ? classes.rowWithAction : '',
                      disabled ? classes.disabledRow : '',
                      dimmed ? classes.dimmedRow : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-selected={rowInteraction?.isSelected?.(row) || undefined}
                    data-disabled={disabled || undefined}
                    data-dimmed={dimmed || undefined}
                    aria-disabled={disabled || undefined}
                    aria-describedby={rowDescription ? rowDescriptionId : undefined}
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
                    {rowDescription ? <VisuallyHidden id={rowDescriptionId}>{rowDescription}</VisuallyHidden> : null}
                    {mobileLayout === 'inline' ? (
                      <div className={classes.inlineRow}>
                        {selection ? (
                          <div
                            className={classes.inlineSelection}
                            role="presentation"
                            onClickCapture={(event) => captureSelectionClick(event, row, index)}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {selectable ? (
                              <Checkbox
                                checked={selectedRowKeySet.has(rowKey)}
                                disabled={disabled}
                                onChange={(event) => changeRowSelection(rowKey, event.currentTarget.checked)}
                                aria-label={selection.getRowLabel?.(row)}
                              />
                            ) : null}
                          </div>
                        ) : null}
                        {leadingColumns.map((column) => (
                          <div key={column.key}>{column.renderCell(row)}</div>
                        ))}
                        <div className={classes.inlinePrimary} data-datatable-primary-cell>
                          {interactionControl}
                          {rowAction ? (
                            <RowActionControl row={row} rowKey={rowKey} rowAction={rowAction} disabled={disabled} />
                          ) : null}
                          <div id={rowNameId}>{primaryColumn?.renderCell(row)}</div>
                        </div>
                        {inlineDetails.map((column) => {
                          const value = column.renderCell(row);
                          return value == null ? null : (
                            <div className={classes.inlineMetadata} key={column.key}>
                              {value}
                            </div>
                          );
                        })}
                        {actionColumns.length > 0 ? (
                          <div
                            className={classes.inlineActions}
                            role="presentation"
                            data-datatable-action-cell
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {actionColumns.map((column) => (
                              <div key={column.key}>{column.renderCell(row)}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <DsLayoutInline justify="between" align="start" gap="sm" wrap="nowrap">
                        <LayoutStack gap="none" flexible>
                          <DsLayoutInline gap="sm" align="start" wrap="nowrap">
                            {selection && (
                              <div
                                className={classes.mobileSelection}
                                role="presentation"
                                onClickCapture={(event) => captureSelectionClick(event, row, index)}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                              >
                                {selectable ? (
                                  <Checkbox
                                    checked={selectedRowKeySet.has(rowKey)}
                                    disabled={disabled || !selectable}
                                    onChange={(event) => changeRowSelection(rowKey, event.currentTarget.checked)}
                                    aria-label={selection.getRowLabel?.(row)}
                                  />
                                ) : null}
                              </div>
                            )}
                            {leadingColumns.map((column) => (
                              <div key={column.key}>{column.renderCell(row)}</div>
                            ))}
                            <LayoutStack gap="none" flexible data-datatable-primary-cell>
                              {interactionControl}
                              {rowAction ? (
                                <RowActionControl row={row} rowKey={rowKey} rowAction={rowAction} disabled={disabled} />
                              ) : null}
                              <div id={rowNameId}>{primaryColumn ? primaryColumn.renderCell(row) : null}</div>
                              {mobileLayout === 'compact' && detailColumns.length > 0 ? (
                                <DsLayoutInline gap="xs" wrap="wrap">
                                  {detailColumns.map((column) => {
                                    const value = column.renderCell(row);
                                    return value == null ? null : <div key={column.key}>{value}</div>;
                                  })}
                                </DsLayoutInline>
                              ) : null}
                            </LayoutStack>
                          </DsLayoutInline>
                        </LayoutStack>
                        {actionColumns.length > 0 && (
                          <DsLayoutInline
                            data-datatable-action-cell
                            gap="xxs"
                            align="start"
                            wrap="nowrap"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {actionColumns.map((column) => (
                              <div key={column.key}>{column.renderCell(row)}</div>
                            ))}
                          </DsLayoutInline>
                        )}
                      </DsLayoutInline>
                    )}

                    {mobileLayout === 'cards' && detailColumns.length > 0 && (
                      <DsLayoutInset blockStart="xs">
                        <DsLayoutInline gap="xs" wrap="wrap">
                          {detailColumns.map((column) => (
                            <MetadataPair key={column.key} label={`${column.header}:`}>
                              {column.renderCell(row)}
                            </MetadataPair>
                          ))}
                        </DsLayoutInline>
                      </DsLayoutInset>
                    )}
                  </div>
                );
              })}
            </LayoutStack>
          </div>
        </LayoutVisibility>
      </div>
    </>
  );
}
