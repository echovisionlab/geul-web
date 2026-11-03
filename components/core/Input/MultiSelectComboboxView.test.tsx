// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import {
  MultiSelectComboboxView,
  type MultiSelectComboboxViewProps,
  type MultiSelectItem,
} from './MultiSelectComboboxView';

const ambient = { id: 'ambient', name: 'Ambient' };
const electronic = { id: 'electronic', name: 'Electronic' };
type FixtureProps = Partial<MultiSelectComboboxViewProps<MultiSelectItem>>;

function Fixture({ onCreate, ...props }: FixtureProps = {}) {
  const [options, setOptions] = useState<MultiSelectItem[]>([ambient, electronic]);
  const [selected, setSelected] = useState<MultiSelectItem[]>([ambient]);
  return (
    <MultiSelectComboboxView
      label="Genres"
      placeholder="Select genres"
      emptyMessage="No genres available"
      notFoundMessage="No genres found"
      loadingLabel="Loading genres"
      options={options}
      selectedItems={selected}
      onSelect={(item) => setSelected((items) => [...items, item])}
      onDeselect={(item) => setSelected((items) => items.filter((selected) => selected.id !== item.id))}
      onCreate={(name) => {
        if (onCreate) {
          onCreate(name);
          return;
        }
        const created = { id: `created-${name}`, name };
        setOptions((items) => [...items, created]);
        setSelected((items) => [...items, created]);
      }}
      createOptionLabel={(name) => `Create "${name}"`}
      canEdit
      canCreateNew
      combineWithSelected
      {...props}
    />
  );
}

const genreInput = () => screen.getByRole('combobox', { name: 'Genres' });

describe('MultiSelectComboboxView editing', () => {
  it('keeps selected labels while searching and adds/removes existing options', async () => {
    const { user } = render(<Fixture />);
    const input = genreInput();
    await user.click(input);
    await user.paste('Electronic');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Ambient'));
    await user.click(await screen.findByRole('option', { name: 'Electronic' }));
    expect(input).toHaveAccessibleDescription(/Ambient.*Electronic/);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Remove Ambient' }));
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Electronic'));
    expect(input).not.toHaveAccessibleDescription(expect.stringContaining('Ambient'));
  });

  it('creates a trimmed option, selects it and keeps its name during a later search', async () => {
    const { user } = render(<Fixture />);
    const input = genreInput();
    await user.click(input);
    await user.paste('  Drone  ');
    await user.click(await screen.findByRole('option', { name: /^Create.*Drone/ }));
    expect(input).toHaveAccessibleDescription(/Ambient.*Drone/);
    await user.click(input);
    await user.paste('Electronic');
    expect(input).toHaveAccessibleDescription(/Ambient.*Drone/);
  });

  it.each([
    { search: '', message: 'No genres available' },
    { search: 'Drone', message: 'No genres found' },
  ])('suppresses premature "$message" until the query settles', async ({ search, message }) => {
    const props = { options: [], selectedItems: [], canCreateNew: false };
    const { user, rerender } = render(<Fixture {...props} isLoading />);
    const input = genreInput();
    const status = screen.getByRole('status', { name: 'Loading genres' });
    expect(status).toHaveTextContent(/^$/);
    await user.click(input);
    if (search) {
      await user.paste(search);
    }
    await screen.findByRole('listbox');
    expect(input).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    rerender(<Fixture {...props} />);
    expect(await screen.findByText(message)).toBeVisible();
    expect(input).not.toHaveAttribute('aria-busy');
    expect(input).toHaveFocus();
  });

  it.each(['isLoading', 'isCreating'] as const)('keeps selection and options usable during %s', async (pending) => {
    const props = { [pending]: true };
    const { user } = render(<Fixture {...props} />);
    const input = genreInput();
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Ambient'));
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: 'Electronic' }));
    expect(input).toHaveAccessibleDescription(/Ambient.*Electronic/);
    expect(input).toHaveAttribute('aria-busy', 'true');
    expect(input).toHaveFocus();
  });

  it('blocks creation during query and create requests, then permits retry without losing focus or search', async () => {
    const onCreate = vi.fn();
    const { user, rerender } = render(<Fixture onCreate={onCreate} isLoading />);
    const input = genreInput();
    await user.type(input, 'Drone');
    expect(screen.queryByRole('option', { name: 'Create "Drone"' })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onCreate).not.toHaveBeenCalled();
    rerender(<Fixture onCreate={onCreate} />);
    await user.click(await screen.findByRole('option', { name: 'Create "Drone"' }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith('Drone');
    rerender(<Fixture onCreate={onCreate} isCreating />);
    await user.type(input, 'Drone');
    expect(screen.queryByRole('option', { name: 'Create "Drone"' })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('No genres found')).not.toBeInTheDocument();
    rerender(<Fixture onCreate={onCreate} />);
    expect(input).toHaveValue('Drone');
    expect(input).toHaveFocus();
    await user.click(await screen.findByRole('option', { name: 'Create "Drone"' }));
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Ambient'));
  });

  it.each([false, true])('prevents editing when disabled, including pending=%s', async (isLoading) => {
    const onCreate = vi.fn();
    const { user } = render(<Fixture canEdit={false} isLoading={isLoading} onCreate={onCreate} />);
    const input = genreInput();
    expect(input).toBeDisabled();
    await user.click(input);
    await user.keyboard('Drone{ArrowDown}{Enter}{Backspace}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Ambient'));
  });
});
