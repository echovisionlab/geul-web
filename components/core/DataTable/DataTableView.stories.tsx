import { useState } from 'react';
import { Text as DsText } from '@/components/core/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutInset, LayoutStack } from '../Layout';
import { SelectionStatus } from '../SelectionSurface';
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
  const [selected, setSelected] = useState(props.selection?.selectedRowKeys ?? []);
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [opened, setOpened] = useState<ExampleRow | null>(null);
  const sortable = props.columns.some((column) => column.sort);
  const previewRows = sortable
    ? [...props.rows].sort((a, b) =>
        direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
      )
    : props.rows;
  return (
    <LayoutStack gap="sm">
      <DataTableView
        {...props}
        rows={previewRows}
        columns={props.columns.map((column) =>
          column.sort
            ? {
                ...column,
                sort: { ...column.sort, direction, onToggle: () => setDirection(direction === 'asc' ? 'desc' : 'asc') },
              }
            : column,
        )}
        selection={
          props.selection
            ? { ...props.selection, selectedRowKeys: selected, onSelectedRowKeysChange: setSelected }
            : undefined
        }
        rowAction={props.rowAction ? { ...props.rowAction, onActivate: setOpened } : undefined}
      />
      {opened && (
        <DsText>
          {opened.name} · {opened.status}
        </DsText>
      )}
    </LayoutStack>
  );
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
    loadingContent: <DsText tone="secondary">Loading records…</DsText>,
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

export const CompactList: Story = { args: { ...SelectableAndSortable.args, mobileLayout: 'compact' } };

/** One line at every width; the narrow layout drops the secondary format column. */
export const InlineList: Story = {
  args: {
    ...SelectableAndSortable.args,
    mobileLayout: 'inline',
    columnSizing: 'fixed',
    desktopMinWidth: 0,
    density: 'compact',
    rows: [
      {
        id: 'one',
        name: 'field-recording-with-a-very-long-filename-that-exceeds-the-available-width.wav',
        status: '80.1 MB',
      },
      { id: 'two', name: 'poster.png', status: '2.3 MB' },
    ],
    columns: [
      {
        key: 'name',
        header: 'Name',
        renderCell: (row) => (
          <DsText size="sm" truncate title={row.name}>
            {row.name}
          </DsText>
        ),
      },
      {
        key: 'format',
        header: 'Format',
        width: 64,
        align: 'end',
        mobileVisibility: 'hidden',
        renderCell: (row) => (
          <DsText size="xs" tone="secondary" align="end">
            {row.name.split('.').at(-1)}
          </DsText>
        ),
      },
      {
        key: 'size',
        header: 'Size',
        width: 80,
        align: 'end',
        renderCell: (row) => (
          <DsText size="xs" tone="secondary" align="end">
            {row.status}
          </DsText>
        ),
      },
    ],
  },
};

/** Long content must fit its track instead of widening the table. Selection shares one alignment slot. */
export const TruncatedNames: Story = {
  args: {
    ...SelectableAndSortable.args,
    columnSizing: 'fixed',
    density: 'compact',
    mobileLayout: 'compact',
    rows: [
      {
        id: 'one',
        name: 'field-recording-with-a-very-long-unbroken-filename-that-exceeds-the-available-column-width.wav',
        status: 'Published',
      },
      rows[1],
    ],
    columns: [
      {
        key: 'name',
        header: 'Name',
        minWidth: 180,
        renderCell: (row) => (
          <DsText size="sm" truncate title={row.name}>
            {row.name}
          </DsText>
        ),
      },
      { key: 'status', header: 'Status', width: 130, renderCell: (row) => row.status },
    ],
  },
};

/** The footer owns one inset boundary; the table draws dividers only between records. */
export const FooterBoundary: Story = {
  args: { ...TruncatedNames.args, rowDividers: 'between' },
  render: (args) => (
    <LayoutStack gap="none">
      <LayoutInset inline={{ base: 'sm', sm: 'md' }} block="none">
        <ExampleDataTableView {...args} />
      </LayoutInset>
      <SelectionStatus density="standard" divider="content">
        {args.rows.length} items
      </SelectionStatus>
    </LayoutStack>
  ),
};
