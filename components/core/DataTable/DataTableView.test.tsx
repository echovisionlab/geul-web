// @vitest-environment jsdom

import { act, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { DataTableView, type DataTableViewProps } from './DataTableView';
import classes from './DataTableView.module.css';
import supportClasses from '../Typography/Support.module.css';

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

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
});

function renderView(props: DataTableViewProps<Row>) {
  act(() => {
    root?.render(
      <I18nProvider locale="en">
        <DataTableView {...props} />
      </I18nProvider>,
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
  it('describes selection constraints without disabling desktop rows or mobile preview commands', () => {
    const keyDown = vi.fn();
    renderView({
      ...baseProps,
      columns: [{ key: 'name', header: 'Name', renderCell: (row) => row.name }],
      rows: [{ id: 'one', name: 'Poster.png', count: 1 }],
      rowInteraction: {
        isDimmed: () => true,
        getDescription: () => 'Cannot add this file. Enter previews it.',
        onKeyDown: keyDown,
      },
    });
    const desktopRow = host!.querySelector<HTMLElement>('[data-datatable-desktop-row="one"]')!;
    const mobileRow = host!.querySelector<HTMLElement>('[data-datatable-mobile-row="one"]')!;
    const command = mobileRow.querySelector<HTMLButtonElement>('[data-datatable-row-interaction-control]')!;
    expect(desktopRow).toHaveAccessibleDescription('Cannot add this file. Enter previews it.');
    expect(mobileRow).toHaveAccessibleDescription('Cannot add this file. Enter previews it.');
    expect(command).toHaveAccessibleName('Poster.png');
    expect(command).toHaveAccessibleDescription('Cannot add this file. Enter previews it.');
    expect(desktopRow.hasAttribute('aria-disabled')).toBe(false);
    expect(mobileRow.hasAttribute('aria-disabled')).toBe(false);
    expect(command.disabled).toBe(false);
    act(() => command.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(keyDown).toHaveBeenCalledOnce();
  });

  it('exposes aria-sort only on the primary sort while preserving secondary priority and direction descriptions', () => {
    renderView({
      ...baseProps,
      rows: [{ id: 'one', name: 'Draft', count: 1 }],
      columns: [
        {
          key: 'name',
          header: 'Name',
          renderCell: (row) => row.name,
          sort: {
            ariaLabel: 'Sort by Name',
            direction: 'desc',
            order: 2,
            showOrder: true,
            description: 'Priority 2/2. Currently descending',
            onToggle: vi.fn(),
          },
        },
        { key: 'id', header: 'ID', renderCell: (row) => row.id, sort: { ariaLabel: 'Sort by ID', onToggle: vi.fn() } },
        {
          key: 'count',
          header: 'Count',
          renderCell: (row) => row.count,
          sort: {
            ariaLabel: 'Sort by Count',
            direction: 'asc',
            order: 1,
            showOrder: true,
            description: 'Priority 1/2. Currently ascending',
            onToggle: vi.fn(),
          },
        },
      ],
    });
    const headers = host!.querySelectorAll('thead th');
    expect(host!.querySelectorAll('[aria-sort]')).toHaveLength(1);
    expect(headers[0].hasAttribute('aria-sort')).toBe(false);
    expect(headers[1].hasAttribute('aria-sort')).toBe(false);
    expect(headers[2].getAttribute('aria-sort')).toBe('ascending');
    const secondary = headers[0].querySelector('button')!;
    const description = document.getElementById(secondary.getAttribute('aria-describedby')!);
    expect(description?.textContent).toBe('Priority 2/2. Currently descending');
    expect(description?.parentElement).toBe(secondary);
    expect(secondary.getAttribute('aria-label')).toBe('Sort by Name');
    expect(secondary.textContent).toContain('↓ 2');
  });

  it('names and focuses the actual horizontal scroll region for a labelled collection', () => {
    renderView({
      ...baseProps,
      accessibleLabel: 'Records',
      rows: [{ id: 'one', name: 'Draft', count: 1 }],
      columns: [{ key: 'name', header: 'Name', renderCell: (row) => row.name }],
    });
    const scroll = host!.querySelector<HTMLElement>('[data-datatable-scroll]')!;
    expect(scroll.getAttribute('role')).toBe('region');
    expect(scroll.getAttribute('aria-label')).toBe('Records');
    expect(scroll.tabIndex).toBe(0);
    act(() => scroll.focus());
    expect(document.activeElement).toBe(scroll);
    expect(scroll.querySelector('table')?.getAttribute('aria-label')).toBe('Records');
  });

  it.each(['editable', 'combobox', 'switch'] as const)(
    'does not activate the row from a custom %s cell control',
    (kind) => {
      const onActivate = vi.fn();
      const renderCell = () =>
        kind === 'editable' ? (
          <div contentEditable suppressContentEditableWarning>
            <span data-cell-control>Edit value</span>
          </div>
        ) : kind === 'combobox' ? (
          <div
            role="combobox"
            aria-label="Choose value"
            aria-expanded={false}
            aria-controls="cell-options"
            tabIndex={0}
          >
            <span data-cell-control>Choose value</span>
          </div>
        ) : (
          <div role="switch" aria-label="Publish" aria-checked={false} tabIndex={0}>
            <span data-cell-control>Publish</span>
          </div>
        );
      renderView({
        ...baseProps,
        rows: [{ id: 'one', name: 'Draft', count: 1 }],
        columns: [{ key: 'name', header: 'Name', renderCell }],
        rowAction: { onActivate, getAccessibleLabel: (row) => `Open ${row.name}` },
      });
      const controls = host!.querySelectorAll<HTMLElement>('[data-cell-control]');
      expect(controls).toHaveLength(2);
      act(() => controls.forEach((control) => control.click()));
      expect(onActivate).not.toHaveBeenCalled();
      act(() => host!.querySelector<HTMLElement>('[data-datatable-desktop-row="one"]')!.click());
      expect(onActivate).toHaveBeenCalledTimes(1);
    },
  );

  it('activates plain mobile cell content when row interaction and row action are composed', () => {
    const onActivate = vi.fn();
    const onClick = vi.fn();
    const row = { id: 'one', name: 'Draft', count: 1 };
    renderView({
      ...baseProps,
      rows: [row],
      columns: [{ key: 'name', header: 'Name', renderCell: (item) => <span data-cell-value>{item.name}</span> }],
      rowAction: { onActivate, getAccessibleLabel: (item) => `Open ${item.name}` },
      rowInteraction: { onClick },
    });
    act(() => host!.querySelector<HTMLElement>('[data-datatable-mobile-row="one"] [data-cell-value]')!.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith(row);
  });

  it.each(['cards', 'compact', 'inline'] as const)(
    'keeps mobile %s selection and menu controls outside the named row trigger',
    (mobileLayout) => {
      const onClick = vi.fn();
      const onKeyDown = vi.fn((event: ReactKeyboardEvent<HTMLElement>, _row: Row, _index: number) => {
        if (event.target === event.currentTarget && event.key === 'Enter') {
          event.preventDefault();
        }
      });
      renderView({
        ...baseProps,
        mobileLayout,
        rows: [{ id: 'one', name: 'Draft', count: 1 }],
        columns: [
          { key: 'name', header: 'Name', renderCell: (row) => row.name },
          {
            key: 'actions',
            header: '',
            kind: 'action',
            accessibleLabel: 'Actions',
            renderCell: () => <button type="button">Menu</button>,
          },
        ],
        selection: {
          selectedRowKeys: [],
          onSelectedRowKeysChange: vi.fn(),
          selectAllRowsLabel: 'Select all',
          getRowLabel: (row) => `Select ${row.name}`,
        },
        rowInteraction: { onClick, onKeyDown },
      });
      const mobile = host!.querySelector<HTMLElement>('[data-datatable-mobile-row="one"]')!;
      expect(mobile.getAttribute('role')).toBe('group');
      expect(mobile.hasAttribute('tabindex')).toBe(false);
      expect(document.getElementById(mobile.getAttribute('aria-labelledby')!)?.textContent).toBe('Draft');
      const trigger = mobile.querySelector<HTMLButtonElement>('[data-datatable-row-interaction-control]')!;
      expect(trigger.tagName).toBe('BUTTON');
      expect(document.getElementById(trigger.getAttribute('aria-labelledby')!)?.textContent).toBe('Draft');
      expect(trigger.contains(mobile.querySelector('input'))).toBe(false);
      expect(trigger.contains(mobile.querySelector('[data-datatable-action-cell]'))).toBe(false);
      act(() => trigger.focus());
      expect(document.activeElement).toBe(trigger);
      act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onKeyDown.mock.calls[0][1]).toEqual({ id: 'one', name: 'Draft', count: 1 });
      act(() => trigger.click());
      expect(onClick).toHaveBeenCalledTimes(1);
      act(() => mobile.querySelector<HTMLInputElement>('input')!.click());
      act(() => mobile.querySelector<HTMLButtonElement>('[data-datatable-action-cell] button')!.click());
      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['cards', 'compact', 'inline'] as const)(
    'keeps mobile %s link modifiers and cell actions independent from row activation',
    (mobileLayout) => {
      const onActivate = vi.fn();
      const onCellAction = vi.fn();
      const row = { id: 'one', name: 'Draft', count: 1 };
      renderView({
        ...baseProps,
        mobileLayout,
        rows: [row],
        columns: [
          { key: 'name', header: 'Name', renderCell: (item) => item.name },
          {
            key: 'actions',
            header: '',
            kind: 'action',
            accessibleLabel: 'Actions',
            renderCell: () => (
              <button type="button" onClick={onCellAction}>
                Edit
              </button>
            ),
          },
        ],
        rowAction: {
          onActivate,
          getHref: (item) => `/records/${item.id}`,
          getAccessibleLabel: (item) => `Open ${item.name}`,
        },
      });
      const mobile = host!.querySelector<HTMLElement>('[data-datatable-mobile-row="one"]')!;
      const link = mobile.querySelector<HTMLAnchorElement>('[data-datatable-row-action-control]')!;
      expect(link.getAttribute('href')).toBe('/records/one');
      const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
      // Preserve the control's default URL intent without asking jsdom to navigate.
      link.addEventListener(
        'click',
        (event) => {
          expect(event.defaultPrevented).toBe(false);
          event.preventDefault();
        },
        { once: true },
      );
      act(() => link.dispatchEvent(modifiedClick));
      expect(onActivate).not.toHaveBeenCalled();
      act(() => mobile.querySelector<HTMLButtonElement>('[data-datatable-action-cell] button')!.click());
      expect(onCellAction).toHaveBeenCalledTimes(1);
      expect(onActivate).not.toHaveBeenCalled();
      act(() => link.click());
      expect(onActivate).toHaveBeenCalledExactlyOnceWith(row);
    },
  );

  it('changes only selectable current-page keys while preserving controlled off-page selection', () => {
    const onChange = vi.fn();
    renderView({
      ...baseProps,
      rows: [
        { id: 'one', name: 'Draft', count: 1 },
        { id: 'disabled', name: 'Disabled', count: 2 },
        { id: 'folder', name: 'Folder', count: 0 },
      ],
      columns: [{ key: 'name', header: 'Name', renderCell: (row) => row.name }],
      rowInteraction: { isDisabled: (row) => row.id === 'disabled' },
      selection: {
        selectedRowKeys: ['off-page', 'disabled', 'folder'],
        onSelectedRowKeysChange: onChange,
        selectAllRowsLabel: 'Select all',
        getRowLabel: (row) => `Select ${row.name}`,
        isRowSelectable: (row) => row.id !== 'folder',
      },
    });
    act(() => host!.querySelector<HTMLInputElement>('thead input[aria-label="Select all"]')!.click());
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['off-page', 'disabled', 'folder', 'one']);
    expect(host!.querySelector<HTMLInputElement>('input[aria-label="Select Disabled"]')!.disabled).toBe(true);
    expect(host!.querySelector('input[aria-label="Select Folder"]')).toBeNull();
  });

  it('names an empty action header without injecting visible header text', () => {
    renderView({
      ...baseProps,
      rows: [{ id: 'one', name: 'Draft', count: 1 }],
      columns: [
        { key: 'name', header: 'Name', accessibleLabel: 'Actions', renderCell: (row) => row.name },
        {
          key: 'actions',
          header: '',
          accessibleLabel: 'Actions',
          kind: 'action',
          renderCell: () => <button type="button">Open</button>,
        },
      ],
    });
    const header = host!.querySelector('thead th:last-child')!;
    expect(header.getAttribute('aria-label')).toBe('Actions');
    const hiddenName = header.querySelector(`.${supportClasses.visuallyHidden}`)!;
    expect(hiddenName.textContent).toBe('Actions');
    expect(hiddenName.parentElement).toBe(header.firstElementChild);
    expect(header.firstElementChild?.childNodes).toHaveLength(1);
    expect(header.getAttribute('scope')).toBe('col');
    expect(host!.querySelector('thead th:first-child')?.getAttribute('aria-label')).toBeNull();
    expect(host!.querySelector('thead th:first-child')?.textContent).toBe('Name');
  });

  it('preserves one result status node across loading, populated and empty transitions and names the collection', () => {
    const props = {
      ...baseProps,
      accessibleLabel: 'Posts',
      loadingMessage: 'Loading posts',
      resultMessage: '1 post',
      columns: [{ key: 'name', header: 'Name', renderCell: (row: Row) => row.name }],
      rows: [{ id: 'one', name: 'Draft', count: 1 }],
    };
    renderView({ ...props, loading: true });
    const status = host!.querySelector('[role="status"]')!;
    expect(status.textContent).toBe('Loading posts');
    renderView(props);
    expect(host!.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent).toBe('1 post');
    expect(host!.querySelector('table')?.getAttribute('aria-label')).toBe('Posts');
    renderView({ ...props, rows: [] });
    expect(host!.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent).toBe('');
    expect(host!.querySelector('[data-datatable-empty]')?.getAttribute('role')).toBe('status');
    expect(host!.querySelector('[data-datatable-empty]')?.textContent).toBe('No records');
  });
  it('keeps inline mobile rows accessible while hiding secondary metadata and retaining selection', () => {
    const onSelection = vi.fn();
    const name = 'field-recording-with-a-long-name.wav';
    renderView({
      ...baseProps,
      mobileLayout: 'inline',
      rows: [{ id: 'one', name, count: 1 }],
      columns: [
        { key: 'name', header: 'Name', renderCell: (row) => row.name },
        { key: 'format', header: 'Format', mobileVisibility: 'hidden', renderCell: () => 'wav' },
        { key: 'size', header: 'Size', align: 'end', renderCell: () => '80.1 MB' },
      ],
      selection: {
        selectedRowKeys: [],
        onSelectedRowKeysChange: onSelection,
        selectAllRowsLabel: 'Select all',
        getRowLabel: (row) => row.name,
      },
    });
    const mobileRow = document.querySelector('[data-datatable-mobile-row="one"]');
    expect(mobileRow?.textContent).toContain(name);
    expect(mobileRow?.textContent).toContain('80.1 MB');
    expect(mobileRow?.querySelector(`.${classes.inlineMetadata}`)?.textContent).toBe('80.1 MB');
    expect(mobileRow?.querySelectorAll(`.${classes.inlineMetadata}`)).toHaveLength(1);
    expect(document.querySelector('thead th:last-child')?.getAttribute('data-align')).toBe('end');
    act(() => mobileRow?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
    expect(onSelection).toHaveBeenCalledWith(['one']);
  });

  it('rejects unsupported mobile presentation at runtime', () => {
    expect(() => renderView({ ...baseProps, mobileLayout: 'custom' as 'inline' })).toThrow(
      'Invalid data table mobile layout',
    );
    expect(() =>
      renderView({
        ...baseProps,
        columns: [
          { key: 'name', header: 'Name', renderCell: (row) => row.name, mobileVisibility: 'custom' as 'hidden' },
        ],
      }),
    ).toThrow('Invalid data table column mobile visibility');
  });
  it('bounds fixed tracks by declared minimums while preserving full cell text', () => {
    const name = 'a-very-long-unbroken-file-name.wav';
    renderView({
      ...baseProps,
      columnSizing: 'fixed',
      desktopMinWidth: 200,
      rows: [{ id: 'one', name, count: 1 }],
      columns: [
        { key: 'name', header: 'Name', minWidth: 220, renderCell: (row) => row.name },
        { key: 'count', header: 'Count', width: 130, renderCell: (row) => row.count },
      ],
      selection: { selectedRowKeys: [], onSelectedRowKeysChange: () => {}, selectAllRowsLabel: 'Select all' },
    });
    expect(document.querySelector('table')?.style.minWidth).toBe('394px');
    expect(document.querySelector('table')?.getAttribute('data-column-sizing')).toBe('fixed');
    const cols = [...document.querySelectorAll('col')];
    expect(cols[0]?.classList.contains(classes.selectionTrack)).toBe(true);
    expect(cols.map((col) => col.style.width)).toEqual(['', '', '130px']);
    expect(document.body.textContent).toContain(name);
  });

  it('rejects unsupported sizing at runtime', () => {
    expect(() => renderView({ ...baseProps, columnSizing: 'custom' as 'fixed' })).toThrow(
      'Invalid data table column sizing',
    );
  });

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

  it('renders mapped cells and emits row, selection, and sort intent', async () => {
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
    expect(scrollContainer?.classList.contains(classes.scroll)).toBe(true);
    expect(desktopTable?.style.minWidth).toBe('640px');
    expect(desktopHeaders?.[0]?.style.minWidth).toBe('var(--geul-interaction-touch)');
    expect(desktopHeaders?.[1]?.style.minWidth).toBe('120px');
    expect(desktopHeaders?.[3]?.style.minWidth).toBe('');

    const sortButton = document.querySelector<HTMLButtonElement>('button[aria-label="Sort by name"]');
    expect(sortButton?.closest('th')?.getAttribute('aria-sort')).toBe('descending');
    expect(sortButton?.getAttribute('data-appearance')).toBe('default');
    expect(sortButton?.hasAttribute('data-full-width')).toBe(true);
    await act(async () => sortButton!.click());
    expect(onSort).toHaveBeenCalledTimes(1);

    await act(async () => document.querySelector<HTMLInputElement>('input[aria-label="Select Alpha"]')!.click());
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith([]);

    await act(async () => document.querySelector<HTMLInputElement>('input[aria-label="Select all records"]')!.click());
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['row-1', 'row-2']);
    expect(onRowActivate).not.toHaveBeenCalled();

    const actionCells = document.querySelectorAll<HTMLElement>('[data-datatable-action-cell]');
    await act(async () => {
      actionCells[0]!.click();
      actionCells[2]!.click();
    });
    expect(onRowActivate).not.toHaveBeenCalled();

    const desktopRow = document.querySelector<HTMLTableRowElement>('[data-datatable-desktop-row="row-1"]');
    const mobileRow = document.querySelector<HTMLElement>('[data-datatable-mobile-row="row-1"]');
    for (const row of [desktopRow, mobileRow]) {
      expect(row?.getAttribute('role')).toBeNull();
      expect(row?.getAttribute('tabindex')).toBeNull();
      expect(row?.getAttribute('aria-label')).toBeNull();
      expect(row?.hasAttribute('data-interactive')).toBe(true);
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

    await act(async () => activationControls[0]!.focus());
    expect(document.activeElement).toBe(activationControls[0]);

    await act(async () => desktopRow!.click());
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0]);

    onRowActivate.mockClear();
    await act(async () => {
      desktopRow?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    });
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0]);

    onRowActivate.mockClear();
    await act(async () => {
      mobileRow?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    });
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0]);

    onRowActivate.mockClear();
    await act(async () => {
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
    await act(async () => activationControls[0]!.dispatchEvent(modifiedClick));
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
    expect(desktopRow?.getAttribute('tabindex')).toBe('0');
    expect(mobileRow?.hasAttribute('tabindex')).toBe(false);
    expect(mobileRow?.querySelector<HTMLButtonElement>('[data-datatable-row-interaction-control]')?.tabIndex).toBe(0);
    for (const renderedRow of [desktopRow, mobileRow]) {
      expect(renderedRow?.hasAttribute('data-selected')).toBe(true);
      expect(renderedRow?.hasAttribute('data-prevent-selection')).toBe(true);
      expect(renderedRow?.hasAttribute('data-dimmed')).toBe(true);
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

  it('keeps disabled rows visible while suppressing activation and selection', async () => {
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
      expect(renderedRow?.hasAttribute('data-disabled')).toBe(true);
      await act(async () => {
        renderedRow!.click();
        renderedRow!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        renderedRow!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      });
    }
    expect(onClick).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Select Disabled"]')?.disabled).toBe(true);

    await act(async () => document.querySelector<HTMLInputElement>('input[aria-label="Select all rows"]')!.click());
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['enabled']);
  });

  it('keeps non-selectable navigation rows interactive while excluding them from checkbox selection', async () => {
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

    expect(document.querySelector('input[aria-label="Select Folder"]')).toBeNull();
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Select File"]')?.disabled).toBe(false);
    await act(async () =>
      document.querySelector<HTMLTableRowElement>('[data-datatable-desktop-row="folder"]')!.click(),
    );
    expect(onClick).toHaveBeenCalledWith(expect.anything(), rows[0], 0);

    await act(async () => document.querySelector<HTMLInputElement>('input[aria-label="Select all files"]')!.click());
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
