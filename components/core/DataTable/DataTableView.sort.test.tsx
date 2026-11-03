// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import { DataTableView, type DataTableViewProps } from './DataTableView';

interface Row {
  id: string;
  name: string;
  count: number;
}

describe('DataTableView sort', () => {
  it('exposes aria-sort only on the primary sort while preserving secondary priority and direction descriptions', () => {
    const props: DataTableViewProps<Row> = {
      getRowKey: (row) => row.id,
      emptyMessage: 'No records',
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
    };
    render(<DataTableView {...props} />);

    const headers = screen.getAllByRole('columnheader');
    expect(headers.filter((header) => header.hasAttribute('aria-sort'))).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: /^Name/ })).not.toHaveAttribute('aria-sort');
    expect(screen.getByRole('columnheader', { name: 'ID' })).not.toHaveAttribute('aria-sort');
    expect(screen.getByRole('columnheader', { name: /^Count/ })).toHaveAttribute('aria-sort', 'ascending');
    const secondary = screen.getByRole('button', { name: 'Sort by Name' });
    expect(secondary).toHaveAccessibleName('Sort by Name');
    expect(secondary).toHaveAccessibleDescription('Priority 2/2. Currently descending');
    expect(within(secondary).getByText('↓ 2')).toBeVisible();
  });
});
