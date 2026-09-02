// @vitest-environment jsdom

import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider, useCombobox } from '@mantine/core';
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
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}
