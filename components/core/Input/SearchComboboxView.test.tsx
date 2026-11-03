// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { useInputCombobox } from './useInputCombobox';
import { SearchComboboxView, type SearchComboboxViewProps } from './SearchComboboxView';

type Member = { id: string; name: string };
function SearchFixture(props: Partial<Omit<SearchComboboxViewProps<Member>, 'combobox'>> = {}) {
  const combobox = useInputCombobox();
  return (
    <SearchComboboxView
      combobox={combobox}
      search="Ada"
      onSearchChange={vi.fn()}
      label="Member"
      placeholder="Search by name"
      debouncedSearch="Ada"
      items={[]}
      getItemId={(item) => item.id}
      getItemText={(item) => item.name}
      renderItem={(item) => (
        <>
          <span aria-hidden>A</span>
          <span>{item.name}</span>
        </>
      )}
      onSelect={vi.fn()}
      minimumQueryMessage="Enter two characters"
      noResultsMessage="Nothing matched"
      {...props}
    />
  );
}

describe('SearchComboboxView', () => {
  it('names options with member names and selects opaque IDs, then dismisses the list', async () => {
    const onSelect = vi.fn();
    const { user } = render(
      <SearchFixture items={[{ id: 'member-opaque-17', name: 'Ada Lovelace' }]} onSelect={onSelect} />,
    );
    const input = screen.getByRole('combobox', { name: 'Member' });
    await user.click(input);
    const option = await screen.findByRole('option', { name: 'Ada Lovelace' });
    expect(option).toHaveTextContent('AAda Lovelace');
    await user.click(option);
    expect(onSelect).toHaveBeenCalledWith('member-opaque-17');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it.each([
    { query: 'a', emptyMessage: undefined, message: 'Enter two characters' },
    { query: 'absent', emptyMessage: undefined, message: 'Nothing matched' },
    { query: 'absent', emptyMessage: 'No members found', message: 'No members found' },
  ])('shows $message only after pending ends', async ({ query, emptyMessage, message }) => {
    const props = { search: query, debouncedSearch: query, emptyMessage };
    const { user, rerender } = render(<SearchFixture {...props} isLoading />);
    const input = screen.getByRole('combobox', { name: 'Member' });
    await user.click(input);
    await screen.findByRole('listbox');
    expect(input).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    rerender(<SearchFixture {...props} />);
    expect(await screen.findByText(message)).toBeVisible();
    expect(input).not.toHaveAttribute('aria-busy');
  });

  it('keeps validation invalid separate from query loading and leaves existing options selectable', async () => {
    const onSelect = vi.fn();
    const { user } = render(
      <SearchFixture
        isLoading
        error="Choose a member"
        items={[{ id: 'member-17', name: 'Ada Lovelace' }]}
        onSelect={onSelect}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Member' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: 'Ada Lovelace' }));
    expect(onSelect).toHaveBeenCalledWith('member-17');
  });
});
