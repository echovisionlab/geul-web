import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef } from '@/lib/types/common/data-table';
import {
  createDataTableViewColumns,
  cycleDataTableSorts,
  parseDataTableMaxSorts,
  parseDataTableSortConfig,
} from './content-view-model';

interface Row {
  displayName: string;
  count: number;
}

describe('data table content view model', () => {
  it('maps repository column definitions into Core view columns', () => {
    const onSort = vi.fn();
    const columns: ColumnDef<Row>[] = [
      { key: 'displayName', header: 'Name', accessor: 'displayName', width: 240, minWidth: 180 },
      { key: 'count', header: 'Count', cell: (row) => `#${row.count}`, sortable: false },
      { key: 'actions', header: '', kind: 'action', cell: () => 'Open' },
    ];

    const viewColumns = createDataTableViewColumns({
      columns,
      currentSorts: [{ field: 'display_name', direction: 'desc' }],
      sortConfig: [{ field: 'display_name', label: 'Name' }],
      getSortAriaLabel: (label) => `Sort by ${label}`,
      onSort,
    });

    expect(viewColumns[0]).toMatchObject({
      key: 'displayName',
      header: 'Name',
      width: 240,
      minWidth: 180,
      sort: {
        ariaLabel: 'Sort by Name',
        direction: 'desc',
        order: 1,
      },
    });
    expect(viewColumns[0]?.renderCell({ displayName: 'Alpha', count: 2 })).toBe('Alpha');
    expect(viewColumns[1]?.renderCell({ displayName: 'Alpha', count: 2 })).toBe('#2');
    expect(viewColumns[1]?.sort).toBeUndefined();
    expect(viewColumns[2]).toMatchObject({ kind: 'action', header: '' });

    viewColumns[0]?.sort?.onToggle();
    expect(onSort).toHaveBeenCalledWith('display_name');
  });

  it('describes each active multi-sort priority in the mapped view model', () => {
    const viewColumns = createDataTableViewColumns<Row>({
      columns: [
        { key: 'displayName', header: 'Name', accessor: 'displayName' },
        { key: 'count', header: 'Count', accessor: 'count' },
      ],
      currentSorts: [
        { field: 'display_name', direction: 'desc' },
        { field: 'count', direction: 'asc' },
      ],
      sortConfig: [
        { field: 'display_name', label: 'Name' },
        { field: 'count', label: 'Count' },
      ],
      getSortAriaLabel: (label) => `Sort by ${label}`,
      getSortPriorityLabel: (priority, total) => `Priority ${priority}/${total}`,
      onSort: vi.fn(),
    });

    expect(viewColumns[0]?.sort).toMatchObject({
      direction: 'desc',
      order: 1,
      description: 'Priority 1/2',
    });
    expect(viewColumns[1]?.sort).toMatchObject({
      direction: 'asc',
      order: 2,
      description: 'Priority 2/2',
    });
  });

  it('parses sibling sort configuration defensively', () => {
    expect(parseDataTableSortConfig('[{"field":"title","label":"Title"}]')).toEqual([
      { field: 'title', label: 'Title' },
    ]);
    expect(parseDataTableSortConfig('{"field":"title"}')).toEqual([]);
    expect(parseDataTableSortConfig('not-json')).toEqual([]);
    expect(parseDataTableMaxSorts('5')).toBe(5);
    expect(parseDataTableMaxSorts('0')).toBe(3);
  });

  it('cycles supported sort fields without mutating unsupported state', () => {
    const supportedSortFields = new Set(['title']);

    expect(cycleDataTableSorts({ field: 'unknown', currentSorts: [], supportedSortFields, maxSorts: 2 })).toBeNull();
    expect(cycleDataTableSorts({ field: 'title', currentSorts: [], supportedSortFields, maxSorts: 2 })).toEqual([
      { field: 'title', direction: 'desc' },
    ]);
    expect(
      cycleDataTableSorts({
        field: 'title',
        currentSorts: [{ field: 'title', direction: 'desc' }],
        supportedSortFields,
        maxSorts: 2,
      }),
    ).toEqual([{ field: 'title', direction: 'asc' }]);
    expect(
      cycleDataTableSorts({
        field: 'title',
        currentSorts: [{ field: 'title', direction: 'asc' }],
        supportedSortFields,
        maxSorts: 2,
      }),
    ).toEqual([]);
  });
});
