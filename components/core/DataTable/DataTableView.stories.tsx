import type { Meta, StoryObj } from '@storybook/nextjs';
import { Text } from '@mantine/core';
import { Button } from '../Button';
import { DataTableView, type DataTableViewProps } from './DataTableView';

interface ExampleRow {
  id: string;
  name: string;
  status: string;
}

const rows: ExampleRow[] = [
  { id: 'one', name: 'First record', status: 'Published' },
  { id: 'two', name: 'Second record', status: 'Draft' },
];

function ExampleDataTableView(props: DataTableViewProps<ExampleRow>) {
  return <DataTableView {...props} />;
}

const meta: Meta<typeof ExampleDataTableView> = {
  title: 'Core/Data Display/DataTableView',
  component: ExampleDataTableView,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof ExampleDataTableView>;

export const Populated: Story = {
  args: {
    rows,
    columns: [
      { key: 'name', header: 'Name', renderCell: (row) => row.name },
      { key: 'status', header: 'Status', renderCell: (row) => row.status },
      { key: 'actions', header: '', kind: 'action', renderCell: () => <Button emphasis="low">Open</Button> },
    ],
    getRowKey: (row) => row.id,
    emptyMessage: 'No records found.',
  },
};

export const Empty: Story = {
  args: {
    ...Populated.args,
    rows: [],
    reservedRowCount: 3,
  },
};

export const Loading: Story = {
  args: {
    ...Populated.args,
    rows: [],
    loading: true,
    loadingContent: <Text c="dimmed">Loading records…</Text>,
    reservedRowCount: 3,
  },
};

export const SelectableAndSortable: Story = {
  args: {
    rows,
    columns: [
      {
        key: 'name',
        header: 'Name',
        renderCell: (row) => row.name,
        sort: { ariaLabel: 'Sort by name', direction: 'desc', onToggle: () => {} },
      },
      { key: 'status', header: 'Status', renderCell: (row) => row.status },
    ],
    getRowKey: (row) => row.id,
    emptyMessage: 'No records found.',
    selection: {
      selectedRowKeys: ['one'],
      onSelectedRowKeysChange: () => {},
      getRowLabel: (row) => `Select ${row.name}`,
      selectAllRowsLabel: 'Select all records',
    },
    rowAction: { onActivate: () => {}, getAccessibleLabel: (row) => `Open ${row.name}` },
  },
};
