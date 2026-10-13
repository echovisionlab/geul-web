import type { Meta, StoryObj } from '@storybook/nextjs';

import { MultiSelect } from './MultiSelect';

const data = ['Ambient', 'Field recording', 'Installation', 'Performance', 'Sound art'];

const meta = {
  title: 'Core/Input/MultiSelect',
  component: MultiSelect,
  parameters: { layout: 'centered' },
  args: {
    label: 'Tags',
    placeholder: 'Choose tags',
    data,
  },
} satisfies Meta<typeof MultiSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Focused: Story = {};
export const Selected: Story = {
  args: { defaultValue: ['Ambient', 'Installation'] },
};
export const Searchable: Story = { args: { searchable: true } };
export const Error: Story = { args: { error: 'Choose at least one tag' } };
export const Disabled: Story = {
  args: { defaultValue: ['Field recording', 'Sound art'], disabled: true },
};
export const Narrow: Story = {
  args: {
    defaultValue: ['Ambient', 'Field recording', 'Installation'],
  },
};
export const CollapsedSelectedValues: Story = {
  args: {
    collapseSelectedValuesToOneLine: true,
    defaultValue: ['Ambient', 'Field recording', 'Installation', 'Performance', 'Sound art'],
  },
};
export const CollapsedSelectedValuesOpen: Story = {
  args: {
    collapseSelectedValuesToOneLine: true,
    defaultDropdownOpened: true,
    defaultValue: ['Ambient', 'Field recording', 'Installation', 'Performance', 'Sound art'],
  },
};
