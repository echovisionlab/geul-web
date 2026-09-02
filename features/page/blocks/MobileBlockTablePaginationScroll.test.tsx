// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileBlockTablePaginationScroll } from './MobileBlockTablePaginationScroll';

let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => currentSearchParams,
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  document.body.innerHTML = '';
  currentSearchParams = new URLSearchParams();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe('MobileBlockTablePaginationScroll', () => {
  it('scrolls the target into view when the table page changes on mobile', () => {
    const target = document.createElement('div');
    target.id = 'block-table-postTable_test';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) =>
        ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false;
          },
        }) as MediaQueryList,
    });

    currentSearchParams = new URLSearchParams({
      postTable_test: JSON.stringify({ page: 1, pageSize: 10 }),
    });

    render(<MobileBlockTablePaginationScroll namespace="postTable_test" targetId="block-table-postTable_test" />);

    expect(target.scrollIntoView).not.toHaveBeenCalled();

    currentSearchParams = new URLSearchParams({
      postTable_test: JSON.stringify({ page: 2, pageSize: 10 }),
    });

    act(() => {
      root?.render(
        <MobileBlockTablePaginationScroll namespace="postTable_test" targetId="block-table-postTable_test" />,
      );
    });

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'smooth',
    });
  });

  it('does not scroll on desktop when the page changes', () => {
    const target = document.createElement('div');
    target.id = 'block-table-workTable_test';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) =>
        ({
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
        }) as MediaQueryList,
    });

    currentSearchParams = new URLSearchParams({
      workTable_test: JSON.stringify({ page: 1, pageSize: 10 }),
    });

    render(<MobileBlockTablePaginationScroll namespace="workTable_test" targetId="block-table-workTable_test" />);

    currentSearchParams = new URLSearchParams({
      workTable_test: JSON.stringify({ page: 2, pageSize: 10 }),
    });

    act(() => {
      root?.render(
        <MobileBlockTablePaginationScroll namespace="workTable_test" targetId="block-table-workTable_test" />,
      );
    });

    expect(target.scrollIntoView).not.toHaveBeenCalled();
  });
});
