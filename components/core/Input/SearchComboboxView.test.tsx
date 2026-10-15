// @vitest-environment jsdom

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import '@testing-library/jest-dom/vitest';
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useInputCombobox as useCombobox } from './useInputCombobox';
import { SearchComboboxView } from './SearchComboboxView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

function OpenCombobox({ children }: { children: (combobox: ReturnType<typeof useCombobox>) => ReactNode }) {
  const combobox = useCombobox();

  useEffect(() => {
    combobox.openDropdown();
  }, [combobox]);

  return children(combobox);
}

describe('SearchComboboxView', () => {
  it('names options with rendered member names while preserving opaque IDs for selection', async () => {
    const selected = vi.fn();
    renderSearch(
      <OpenCombobox>
        {(combobox) => (
          <SearchComboboxView
            combobox={combobox}
            search="Ada"
            onSearchChange={() => {}}
            label={<span>Member</span>}
            placeholder="Search by name"
            debouncedSearch="Ada"
            items={[{ id: 'member-opaque-17', name: 'Ada Lovelace' }]}
            getItemId={(item) => item.id}
            getItemText={(item) => item.name}
            renderItem={(item) => (
              <>
                <span aria-hidden>A</span>
                <span>{item.name}</span>
              </>
            )}
            onSelect={selected}
            minimumQueryMessage="Enter two characters"
            noResultsMessage="No results"
          />
        )}
      </OpenCombobox>,
    );
    const input = document.querySelector('[role="combobox"]');
    expect(input).toHaveAccessibleName('Member');
    const option = document.querySelector<HTMLElement>('[role="option"]')!;
    expect(option).toHaveAccessibleName('Ada Lovelace');
    expect(option.textContent).toBe('AAda Lovelace');
    await act(async () => option.click());
    expect(selected).toHaveBeenCalledWith('member-opaque-17');
  });

  it('renders caller-supplied minimum-query and empty-result messages', () => {
    renderSearch(
      <OpenCombobox>
        {(combobox) => (
          <SearchComboboxView
            combobox={combobox}
            search="a"
            onSearchChange={vi.fn()}
            label="Member"
            placeholder="Search"
            items={[]}
            debouncedSearch="a"
            onSelect={vi.fn()}
            renderItem={(item: { id: string }) => item.id}
            getItemId={(item: { id: string }) => item.id}
            getItemText={(item: { id: string }) => item.id}
            minimumQueryMessage="Enter two characters"
            noResultsMessage="Nothing matched"
          />
        )}
      </OpenCombobox>,
    );

    expect(document.body.textContent).toContain('Enter two characters');
    expect(document.body.textContent).toContain('Member');

    renderSearch(
      <OpenCombobox>
        {(combobox) => (
          <SearchComboboxView
            combobox={combobox}
            search="absent"
            onSearchChange={vi.fn()}
            placeholder="Search"
            items={[]}
            debouncedSearch="absent"
            onSelect={vi.fn()}
            renderItem={(item: { id: string }) => item.id}
            getItemId={(item: { id: string }) => item.id}
            getItemText={(item: { id: string }) => item.id}
            minimumQueryMessage="Enter two characters"
            noResultsMessage="Nothing matched"
          />
        )}
      </OpenCombobox>,
      true,
    );

    expect(document.body.textContent).toContain('Nothing matched');
  });
});

function renderSearch(node: ReactNode, reuseRoot = false) {
  if (!reuseRoot || !root || !container) {
    container?.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }

  act(() => {
    root?.render(<DesignSystemProvider>{node}</DesignSystemProvider>);
  });
}
