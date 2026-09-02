// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { TableOfContentsView, type TocItem } from './TableOfContentsView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
    window.setTimeout(() => callback(performance.now()), 0),
  );
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    window.clearTimeout(id);
  });
  scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollIntoView = scrollIntoView as typeof HTMLElement.prototype.scrollIntoView;
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('TableOfContentsView', () => {
  it('does not render when the caller provides three or fewer items', async () => {
    renderToc(
      <TableOfContents
        items={[
          { id: 'one', label: 'One', level: 2 },
          { id: 'two', label: 'Two', level: 2 },
          { id: 'three', label: 'Three', level: 2 },
        ]}
      />,
    );
    await flushTocSchedule();

    expect(container?.querySelector('[data-toc-index]')).toBeNull();
  });

  it('defers rail rendering until after the page can paint', async () => {
    renderToc(<TableOfContents items={items(4)} />);

    expect(container?.querySelectorAll('[data-toc-index]')).toHaveLength(0);

    await flushTocSchedule();

    expect(container?.querySelectorAll('[data-toc-index]')).toHaveLength(4);
  });

  it('smooth-scrolls the selected heading on click without relying on DOM heading scans', async () => {
    renderToc(
      <>
        <h2 id="section-1">Section 1</h2>
        <h2 id="section-2">Section 2</h2>
        <h2 id="section-3">Section 3</h2>
        <h2 id="section-4">Section 4</h2>
        <TableOfContents items={items(4)} />
      </>,
    );
    await flushTocSchedule();

    const secondLink = container?.querySelector<HTMLAnchorElement>('[href="#section-2"]');
    expect(secondLink).toBeTruthy();

    await act(async () => {
      secondLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('clears a previously rendered rail when the item count drops below the threshold', async () => {
    renderToc(<TableOfContents items={items(4)} />);
    await flushTocSchedule();
    expect(container?.querySelectorAll('[data-toc-index]')).toHaveLength(4);

    renderToc(<TableOfContents items={items(3)} />, { reuseRoot: true });
    await flushTocSchedule();

    expect(container?.querySelector('[data-toc-index]')).toBeNull();
  });
});

function renderToc(node: ReactNode, options?: { reuseRoot?: boolean }) {
  if (!options?.reuseRoot || !root || !container) {
    container?.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }

  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

function TableOfContents({ items }: { items: TocItem[] }) {
  return <TableOfContentsView items={items} title="Contents" footerSelector="footer" />;
}

async function flushTocSchedule() {
  await act(async () => {
    vi.runAllTimers();
    await Promise.resolve();
  });
}

function items(count: number): TocItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `section-${index + 1}`,
    label: `Section ${index + 1}`,
    level: 2,
  }));
}
