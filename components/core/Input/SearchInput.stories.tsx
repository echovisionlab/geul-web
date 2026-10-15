import type { Meta, StoryObj } from '@storybook/nextjs';
import { SearchInput } from './SearchInput';

const meta = {
  title: 'Core/Input/SearchInput',
  component: SearchInput,
  parameters: { layout: 'centered' },
  args: { 'aria-label': 'Search', placeholder: 'Search' },
} satisfies Meta<typeof SearchInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Filled: Story = { args: { defaultValue: 'Seoul' } };
export const CompactToolbar: Story = { args: { size: 'xs', density: 'compact' } };
export const WithVisibleLabel: Story = {
  args: { 'aria-label': undefined, label: 'Search submissions', description: 'Matches names and email addresses.' },
};
export const Disabled: Story = { args: { disabled: true } };
