import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconDownload, IconTrash } from '@tabler/icons-react';
import { Stack } from '@mantine/core';
import { Button } from '../Button';
import { TextInput } from '../Input';
import { DataTableActions } from './DataTableActions';
import { DataTableSelectionToolbar } from './DataTableSelectionToolbar';
import { DataTableToolbar } from './DataTableToolbar';
import { TableRowMenu } from './TableRowMenu';

const meta: Meta<typeof DataTableToolbar> = {
  title: 'Core/Data Display/DataTable',
  component: DataTableToolbar,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof DataTableToolbar>;

export const Toolbar: Story = {
  render: () => (
    <DataTableToolbar>
      <TextInput aria-label="Search records" placeholder="Search records" />
      <DataTableActions>
        <Button emphasis="medium" leftSection={<IconDownload size={14} />}>
          Export
        </Button>
        <TableRowMenu
          aria-label="Table actions"
          items={[
            { label: 'Archive selected', onClick: () => undefined },
            { label: 'Delete selected', icon: <IconTrash size={14} />, color: 'red', onClick: () => undefined },
          ]}
        />
      </DataTableActions>
    </DataTableToolbar>
  ),
};

export const SelectionToolbar: Story = {
  render: () => (
    <Stack gap="md">
      <DataTableSelectionToolbar
        search={<TextInput aria-label="Search artists" placeholder="Search artists" />}
        selectedCountLabel="3 selected"
        filters={<Button emphasis="medium">Filters</Button>}
        sorts={<Button emphasis="medium">Sort</Button>}
        actions={
          <TableRowMenu
            aria-label="Selected row actions"
            items={[{ label: 'Delete selected', color: 'red', onClick: () => undefined }]}
          />
        }
      />
    </Stack>
  ),
};
