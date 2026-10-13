// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchComboboxView } from './SearchComboboxView';
import { SearchInput } from './SearchInput';
import type { InputComboboxController } from './useInputCombobox';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function render(node: ReactNode) {
  act(() => root.render(<I18nProvider locale="en-US">{node}</I18nProvider>));
}

describe('Core SearchInput', () => {
  it('exposes native search semantics with the Core leading glyph', () => {
    const onChange = vi.fn();
    render(<SearchInput aria-label="Search users" placeholder="Search users" value="" onChange={onChange} />);
    const input = container.querySelector('input')!;
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('inputmode', 'search');
    expect(input).toHaveAccessibleName('Search users');
    expect(container.querySelector('[data-search-glyph] svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps TextInput size and density on the field root', () => {
    render(<SearchInput aria-label="Search" size="xs" density="compact" />);
    const field = container.querySelector('[data-geul-input]')!;
    expect(field).toHaveAttribute('data-geul-input-size', 'xs');
    expect(field).toHaveAttribute('data-geul-input-density', 'compact');
  });
});

describe('SearchComboboxView leading glyph', () => {
  const combobox = {
    dropdownOpened: false,
    openDropdown: vi.fn(),
    closeDropdown: vi.fn(),
    toggleDropdown: vi.fn(),
  } as unknown as InputComboboxController;
  const base = {
    combobox,
    search: '',
    onSearchChange: vi.fn(),
    placeholder: 'Search clients',
    items: [] as string[],
    debouncedSearch: '',
    onSelect: vi.fn(),
    renderItem: (item: string) => item,
    getItemId: (item: string) => item,
    getItemText: (item: string) => item,
    minimumQueryMessage: 'Type more',
    noResultsMessage: 'No results',
  };

  it('renders the shared search glyph', () => {
    render(<SearchComboboxView {...base} leadingGlyph="search" />);
    expect(container.querySelector('[data-search-glyph]')).not.toBeNull();
  });

  it('rejects a second leading slot', () => {
    expect(() => render(<SearchComboboxView {...base} leadingGlyph="search" leftSection={<span />} />)).toThrow(
      'cannot be combined with leftSection',
    );
  });
});
