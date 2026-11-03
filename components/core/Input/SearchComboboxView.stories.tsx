import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SearchComboboxView } from './SearchComboboxView';
import { useInputCombobox } from './useInputCombobox';

const items = [
  { id: 'member-opaque-17', name: 'Ada Lovelace' },
  { id: 'member-opaque-21', name: 'Grace Hopper' },
];
function SearchFixture({ onSelect, isLoading = false }: { onSelect: (id: string) => void; isLoading?: boolean }) {
  const [search, setSearch] = useState('');
  const combobox = useInputCombobox();
  return (
    <SearchComboboxView
      combobox={combobox}
      label="Member"
      placeholder="Search by name"
      search={search}
      onSearchChange={setSearch}
      debouncedSearch={search}
      items={isLoading ? [] : items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))}
      isLoading={isLoading}
      getItemId={(item) => item.id}
      getItemText={(item) => item.name}
      renderItem={(item) => <span>{item.name}</span>}
      onSelect={onSelect}
      minimumQueryMessage="Enter two characters"
      noResultsMessage="No results"
    />
  );
}
const meta = {
  title: 'Core/Input/SearchComboboxView',
  component: SearchFixture,
  parameters: { layout: 'centered' },
  args: { onSelect: fn() },
} satisfies Meta<typeof SearchFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Pending: Story = {
  args: { isLoading: true },
  parameters: {
    docs: {
      description: {
        story:
          'Focus the search field to inspect pending with an empty collection. The existing input spinner and busy state remain; minimum-query and no-results copy wait for loading to end. Existing options remain selectable while refreshing. error retains its input-validation meaning; callers own query failures and retry UI.',
      },
    },
  },
};
export const KeyboardMemberSelection: Story = {
  tags: ['a11y-smoke'],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox', { name: 'Member' });
    await userEvent.click(input);
    await userEvent.type(input, 'Ada');
    const option = within(document.body).getByRole('option', { name: 'Ada Lovelace' });
    await expect(option).toHaveAccessibleName('Ada Lovelace');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onSelect).toHaveBeenCalledWith('member-opaque-17');
    await expect(input).toHaveFocus();
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  },
};
