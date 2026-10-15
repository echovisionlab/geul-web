import type { Meta, StoryObj } from '@storybook/nextjs';
import { ToolbarLayout } from './ToolbarLayout';
import { TextInput, Select } from '../Input';
import { LayoutInline } from '../Layout';
import { localizedRender } from '../../../.storybook/fixture-i18n';

const meta: Meta<typeof ToolbarLayout> = {
  title: 'Core/Layout/ToolbarLayout',
  component: ToolbarLayout,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shared container-responsive search/filter/action layout. Compact controls inherit one scale; native input keyboard behavior and tab order are retained. Use ToolbarSurface for contextual command navigation.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ToolbarLayout>;

export const Collection: Story = {
  args: { arrangement: 'actions-inline', inset: 'content' },
  render: localizedRender((args) => (
    <ToolbarLayout
      {...args}
      search={<TextInput aria-label="Search files and folders" placeholder="Search files and folders" />}
      filters={
        <LayoutInline gap="xs" wrap="nowrap" fill="inline">
          <Select aria-label="Sort" data={['Name', 'Newest']} defaultValue="Name" />
          <Select aria-label="Type" data={['All types', 'Audio', 'Images']} defaultValue="All types" />
        </LayoutInline>
      }
    />
  )),
};

export const TableControls: Story = {
  args: { arrangement: 'actions-end' },
  render: localizedRender((args) => (
    <ToolbarLayout {...args} search={<TextInput aria-label="Search records" placeholder="Search records" />} />
  )),
};
