// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { DataTableSelectionToolbar } from './DataTableSelectionToolbar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

describe('DataTableSelectionToolbar', () => {
  it('renders search, selected count, and right-side controls together', () => {
    render(
      <DataTableSelectionToolbar
        search={<input aria-label="Search rows" />}
        selectedCountLabel="2 selected"
        filters={<button type="button">Filters</button>}
        sorts={<button type="button">Sort</button>}
        actions={<button type="button">Actions</button>}
      />,
    );

    expect(document.querySelector('input[aria-label="Search rows"]')).not.toBeNull();
    expect(document.body.textContent).toContain('2 selected');
    expect(document.body.textContent).toContain('Filters');
    expect(document.body.textContent).toContain('Sort');
    expect(document.body.textContent).toContain('Actions');
  });

  it('omits the selected count when no label is provided', () => {
    render(<DataTableSelectionToolbar search={<input aria-label="Search rows" />} />);

    expect(document.querySelector('input[aria-label="Search rows"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('selected');
  });
});
