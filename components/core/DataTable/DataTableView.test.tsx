// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { DataTableView, type DataTableViewProps } from './DataTableView';
import classes from './DataTableView.module.css';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

interface Row {
  id: string;
  name: string;
  count: number;
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
});

function renderView(props: DataTableViewProps<Row>) {
  act(() => {
    root?.render(
      <MantineProvider>
        <DataTableView {...props} />
      </MantineProvider>,
    );
  });
}

const baseProps: DataTableViewProps<Row> = {
  columns: [],
  rows: [],
  getRowKey: (row) => row.id,
  emptyMessage: 'No records',
};

describe('DataTableView', () => {
  it('renders caller-provided loading and empty content with reserved height', () => {
    renderView({
      ...baseProps,
      loading: true,
      loadingContent: <span data-testid="loader">Loading records</span>,
      reservedRowCount: 2,
    });

    const loadingSurface = document.querySelector('[data-datatable-loading]');
    expect(loadingSurface?.getAttribute('aria-busy')).toBe('true');
    expect((loadingSurface as HTMLElement | null)?.style.minHeight).toBe('164px');
    expect(document.querySelector('[data-testid="loader"]')?.textContent).toBe('Loading records');

    renderView({ ...baseProps, reservedRowCount: 2 });

    expect(document.body.textContent).toContain('No records');
    expect(document.querySelector<HTMLElement>('[data-datatable-empty]')?.style.minHeight).toBe('164px');
  });

  it('renders mapped cells and emits row, selection, and sort intent', () => {
    const onRowActivate = vi.fn();
    const onSelectedRowKeysChange = vi.fn();
    const onSort = vi.fn();
    const rows: Row[] = [
      { id: 'row-1', name: 'Alpha', count: 2 },
      { id: 'row-2', name: 'Beta', count: 3 },
    ];

    renderView({
      ...baseProps,
      rows,
      columns: [
        {
          key: 'name',
          header: 'Name',
          minWidth: 120,
          renderCell: (row) => row.name,
          sort: {
            ariaLabel: 'Sort by name',
            description: 'Priority 1 of 2',
            direction: 'desc',
            order: 1,
            showOrder: true,
            onToggle: onSort,
          },
        },
        { key: 'count', header: 'Count', renderCell: (row) => `#${row.count}` },
        { key: 'actions', header: '', kind: 'action', renderCell: () => <button type="button">Open</button> },
      ],
      rowAction: {
        getHref: (row) => `/records/${row.id}`,
        onActivate: onRowActivate,
        getAccessibleLabel: (row) => `Open ${row.name}`,
      },
      selection: {
        selectedRowKeys: ['row-1'],
        onSelectedRowKeysChange,
        getRowLabel: (row) => `Select ${row.name}`,
        selectAllRowsLabel: 'Select all records',
      },
    });

    expect(document.body.textContent).toContain('Alpha');
    expect(document.body.textContent).toContain('#3');
    expect(document.body.textContent).toContain('↓ 1');

    const scrollContainer = document.querySelector<HTMLElement>('[data-datatable-scroll]');
    const desktopTable = scrollContainer?.querySelector<HTMLTableElement>('table');
    const desktopHeaders = desktopTable?.querySelectorAll<HTMLTableCellElement>('thead th');
    expect(scrollContainer?.style.overflowX).toBe('auto');
    expect(desktopTable?.style.minWidth).toBe('640px');
    expect(desktopHeaders?.[0]?.style.minWidth).toBe('44px');
    expect(desktopHeaders?.[1]?.style.minWidth).toBe('120px');
    expect(desktopHeaders?.[3]?.style.minWidth).toBe('');

    const sortButton = document.querySelector<HTMLButtonElement>('button[aria-label="Sort by name. Priority 1 of 2"]');
    expect(sortButton?.closest('th')?.getAttribute('aria-sort')).toBe('descending');
    expect(sortButton?.getAttribute('data-appearance')).toBe('default');
    expect(sortButton?.hasAttribute('data-full-width')).toBe(true);
    sortButton?.click();
    expect(onSort).toHaveBeenCalledTimes(1);

    document.querySelector<HTMLInputElement>('input[aria-label="Select Alpha"]')?.click();
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith([]);

    document.querySelector<HTMLInputElement>('input[aria-label="Select all records"]')?.click();
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['row-1', 'row-2']);
    expect(onRowActivate).not.toHaveBeenCalled();

    const actionCells = document.querySelectorAll<HTMLElement>('[data-datatable-action-cell]');
    actionCells[0]?.click();
    actionCells[2]?.click();
    expect(onRowActivate).not.toHaveBeenCalled();

    const desktopRow = document.querySelector<HTMLTableRowElement>('[data-datatable-desktop-row="row-1"]');
    const mobileRow = document.querySelector<HTMLElement>('[data-datatable-mobile-row="row-1"]');
    for (const row of [desktopRow, mobileRow]) {
      expect(row?.getAttribute('role')).toBeNull();
      expect(row?.getAttribute('tabindex')).toBeNull();
      expect(row?.getAttribute('aria-label')).toBeNull();
      expect(row?.classList.contains(classes.rowWithAction)).toBe(true);
    }

    const activationControls = document.querySelectorAll<HTMLAnchorElement>(
      '[data-datatable-row-action-control="row-1"]',
    );
    expect(activationControls).toHaveLength(2);
    for (const control of activationControls) {
      expect(control.tagName).toBe('A');
      expect(control.getAttribute('href')).toBe('/records/row-1');
      expect(control.textContent).toBe('Open Alpha');
      expect(control.classList.contains(classes.rowActionControl)).toBe(true);
    }

    act(() => activationControls[0]?.focus());
    expect(document.activeElement).toBe(activationControls[0]);

    desktopRow?.click();
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0]);

    onRowActivate.mockClear();
    act(() => {
      desktopRow?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    });
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0]);

    onRowActivate.mockClear();
    act(() => {
      mobileRow?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    });
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0]);

    onRowActivate.mockClear();
    act(() => {
      activationControls[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      activationControls[0]?.click();
    });
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0]);

    onRowActivate.mockClear();
    const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    let preventedByRowAction = true;
    host?.addEventListener(
      'click',
      (event) => {
        preventedByRowAction = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    act(() => activationControls[0]?.dispatchEvent(modifiedClick));
    expect(onRowActivate).not.toHaveBeenCalled();
    expect(preventedByRowAction).toBe(false);
  });

  it('allows dense consumers to lower the desktop table minimum width', () => {
    renderView({
      ...baseProps,
      rows: [{ id: 'row-1', name: 'Alpha', count: 2 }],
      columns: [{ key: 'name', header: 'Name', renderCell: (row) => row.name }],
      desktopMinWidth: 560,
    });

    expect(document.querySelector<HTMLElement>('[data-datatable-scroll] table')?.style.minWidth).toBe('560px');
  });

  it('keeps file-browser row interactions opt-in', () => {
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    const onContextMenu = vi.fn();
    const onKeyDown = vi.fn();
    const row = { id: 'row-1', name: 'Alpha', count: 2 };

    renderView({
      ...baseProps,
      rows: [row],
      columns: [{ key: 'name', header: 'Name', renderCell: (item) => item.name }],
      rowInteraction: {
        isSelected: () => true,
        isDimmed: () => true,
        preventTextSelection: true,
        onClick,
        onDoubleClick,
        onContextMenu,
        onKeyDown,
      },
    });

    const desktopRow = document.querySelector<HTMLTableRowElement>('[data-datatable-desktop-row="row-1"]');
    const mobileRow = document.querySelector<HTMLElement>('[data-datatable-mobile-row="row-1"]');
    for (const renderedRow of [desktopRow, mobileRow]) {
      expect(renderedRow?.getAttribute('tabindex')).toBe('0');
      expect(renderedRow?.hasAttribute('data-selected')).toBe(true);
      expect(renderedRow?.style.userSelect).toBe('none');
      expect(renderedRow?.classList.contains(classes.dimmedRow)).toBe(true);
    }

    desktopRow?.click();
    desktopRow?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    desktopRow?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    desktopRow?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

    expect(onClick).toHaveBeenCalledWith(expect.anything(), row, 0);
    expect(onDoubleClick).toHaveBeenCalledWith(expect.anything(), row, 0);
    expect(onContextMenu).toHaveBeenCalledWith(expect.anything(), row, 0);
    expect(onKeyDown).toHaveBeenCalledWith(expect.anything(), row, 0);
  });

  it('keeps disabled rows visible while suppressing activation and selection', () => {
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    const onKeyDown = vi.fn();
    const onSelectedRowKeysChange = vi.fn();
    const rows: Row[] = [
      { id: 'enabled', name: 'Enabled', count: 1 },
      { id: 'disabled', name: 'Disabled', count: 2 },
    ];

    renderView({
      ...baseProps,
      rows,
      columns: [{ key: 'name', header: 'Name', renderCell: (item) => item.name }],
      selection: {
        selectedRowKeys: [],
        onSelectedRowKeysChange,
        getRowLabel: (row) => `Select ${row.name}`,
        selectAllRowsLabel: 'Select all rows',
      },
      rowInteraction: {
        isDisabled: (row) => row.id === 'disabled',
        onClick,
        onDoubleClick,
        onKeyDown,
      },
    });

    const desktopRow = document.querySelector<HTMLTableRowElement>('[data-datatable-desktop-row="disabled"]');
    const mobileRow = document.querySelector<HTMLElement>('[data-datatable-mobile-row="disabled"]');
    for (const renderedRow of [desktopRow, mobileRow]) {
      expect(renderedRow?.getAttribute('aria-disabled')).toBe('true');
      expect(renderedRow?.hasAttribute('data-disabled')).toBe(true);
      expect(renderedRow?.classList.contains(classes.disabledRow)).toBe(true);
      renderedRow?.click();
      renderedRow?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      renderedRow?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    }
    expect(onClick).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Select Disabled"]')?.disabled).toBe(true);

    document.querySelector<HTMLInputElement>('input[aria-label="Select all rows"]')?.click();
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['enabled']);
  });

  it('keeps non-selectable navigation rows interactive while excluding them from checkbox selection', () => {
    const onClick = vi.fn();
    const onSelectedRowKeysChange = vi.fn();
    const rows: Row[] = [
      { id: 'folder', name: 'Folder', count: 0 },
      { id: 'file', name: 'File', count: 1 },
    ];

    renderView({
      ...baseProps,
      rows,
      columns: [{ key: 'name', header: 'Name', renderCell: (row) => row.name }],
      selection: {
        selectedRowKeys: [],
        onSelectedRowKeysChange,
        getRowLabel: (row) => `Select ${row.name}`,
        selectAllRowsLabel: 'Select all files',
        isRowSelectable: (row) => row.id === 'file',
      },
      rowInteraction: { onClick },
    });

    expect(document.querySelector<HTMLInputElement>('input[aria-label="Select Folder"]')?.disabled).toBe(true);
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Select File"]')?.disabled).toBe(false);
    document.querySelector<HTMLTableRowElement>('[data-datatable-desktop-row="folder"]')?.click();
    expect(onClick).toHaveBeenCalledWith(expect.anything(), rows[0], 0);

    document.querySelector<HTMLInputElement>('input[aria-label="Select all files"]')?.click();
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['file']);
  });

  it('preserves disabled sortable-header semantics through TextButton', () => {
    const onSort = vi.fn();

    renderView({
      ...baseProps,
      rows: [{ id: 'row-1', name: 'Alpha', count: 2 }],
      columns: [
        {
          key: 'name',
          header: 'Name',
          renderCell: (row) => row.name,
          sort: {
            ariaLabel: 'Sort by name',
            direction: 'asc',
            disabled: true,
            onToggle: onSort,
          },
        },
      ],
    });

    const sortButton = document.querySelector<HTMLButtonElement>('button[aria-label="Sort by name"]');
    expect(sortButton?.disabled).toBe(true);
    expect(sortButton?.hasAttribute('data-full-width')).toBe(true);
    expect(sortButton?.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(sortButton?.textContent).toContain('↑');

    sortButton?.click();
    expect(onSort).not.toHaveBeenCalled();
  });

  it('uses native button controls without duplicate keyboard activation', () => {
    const onRowActivate = vi.fn();
    const row = { id: 'row-1', name: 'Alpha', count: 2 };

    renderView({
      ...baseProps,
      rows: [row],
      columns: [{ key: 'name', header: 'Name', renderCell: (item) => item.name }],
      rowAction: {
        onActivate: onRowActivate,
        getAccessibleLabel: (item) => `Open ${item.name}`,
      },
    });

    const activationControls = document.querySelectorAll<HTMLButtonElement>(
      '[data-datatable-row-action-control="row-1"]',
    );
    expect(activationControls).toHaveLength(2);
    expect(Array.from(activationControls).every((control) => control.tagName === 'BUTTON')).toBe(true);

    act(() => {
      activationControls[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      activationControls[0]?.click();
    });
    expect(onRowActivate).toHaveBeenCalledTimes(1);

    onRowActivate.mockClear();
    act(() => {
      activationControls[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      activationControls[1]?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      activationControls[1]?.click();
    });
    expect(onRowActivate).toHaveBeenCalledTimes(1);
  });
});
