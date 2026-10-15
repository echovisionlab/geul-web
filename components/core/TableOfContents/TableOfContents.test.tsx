// @vitest-environment jsdom

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableOfContentsView, type TocItem } from './TableOfContentsView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A fresh narrow-screen, no-preference media environment per test (tests spy on it to vary it). */
function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  installMatchMedia();
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

  it('owns print omission of the outline and its reserved space instead of exposing its module class to global print CSS', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'components/core/TableOfContents/TableOfContents.module.css'),
      'utf8',
    );
    const printCss = readFileSync(resolve(process.cwd(), 'lib/styles/print.css'), 'utf8');
    expect(css).toMatch(/@media print\s*\{\s*\.wrapper,\s*\.track\s*\{\s*display: none;/);
    expect(css).toMatch(/@media print[\s\S]*--_table-of-contents-inset-end: 0px;/);
    expect(printCss).not.toContain('TableOfContents_');
  });

  it('publishes the reserved inline space to a document scope and keeps coarse-pointer rows at the shared minimum', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'components/core/TableOfContents/TableOfContents.module.css'),
      'utf8',
    );
    expect(css).toContain(':global([data-table-of-contents-scope]):has(.layout[data-outline])');
    expect(css).toMatch(
      /\.layout\[data-outline\] \{\s*padding-inline: var\(--_table-of-contents-inset-start\) var\(--_table-of-contents-inset-end\);/,
    );
    expect(css).toMatch(/\.column \.link \{[^}]*min-height: var\(--geul-interaction-minimum\);/);
  });

  it('puts the outline before the document in reading order and fits it below the sticky line from the start', async () => {
    renderToc(
      <TableOfContentsView items={items(4)} title="Contents" contentPlacement="center">
        <p id="document">Document</p>
      </TableOfContentsView>,
    );
    await flushTocSchedule();
    const layout = container!.querySelector<HTMLElement>('[data-outline]')!;
    const navigation = layout.querySelector<HTMLElement>('[role="navigation"]')!;
    expect(layout.firstElementChild!.contains(navigation)).toBe(true);
    expect(layout.lastElementChild!.id).toBe('document');
    expect(navigation.style.getPropertyValue('--_toc-start-offset')).toBe('0px');
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

  it('moves keyboard activation to the target heading, keeps it outside Tab order and exposes navigation/current meaning', async () => {
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
    const link = container!.querySelector<HTMLAnchorElement>('[href="#section-2"]')!;
    const heading = container!.querySelector<HTMLElement>('#section-2')!;
    expect(container!.querySelector('[role="navigation"]')?.getAttribute('aria-label')).toBe('Contents');
    expect(container!.querySelector('[aria-current="location"]')).not.toBeNull();
    act(() => {
      link.focus();
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    expect(document.activeElement).toBe(heading);
    expect(heading.tabIndex).toBe(-1);
    act(() => link.focus());
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });

  it('preserves reduced motion preference when activating a heading', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    renderToc(
      <>
        <h2 id="section-1">Section 1</h2>
        <TableOfContents items={items(4)} />
      </>,
    );
    await flushTocSchedule();
    act(() => container!.querySelector<HTMLAnchorElement>('[data-toc-index="0"]')!.click());
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('clears a previously rendered rail when the item count drops below the threshold', async () => {
    renderToc(<TableOfContents items={items(4)} />);
    await flushTocSchedule();
    expect(container?.querySelectorAll('[data-toc-index]')).toHaveLength(4);

    renderToc(<TableOfContents items={items(3)} />, { reuseRoot: true });
    await flushTocSchedule();

    expect(container?.querySelector('[data-toc-index]')).toBeNull();
  });

  it('retains all 120 destinations while bounding only decorative marks', async () => {
    const headings = items(120).map((item, index) => ({ ...item, level: index % 2 === 0 ? 2 : 3 }));
    renderToc(<TableOfContents items={headings} />);
    await flushTocSchedule();

    const links = container!.querySelectorAll<HTMLAnchorElement>('[data-toc-index]');
    expect(links).toHaveLength(120);
    expect(links[links.length - 1].getAttribute('href')).toBe('#section-120');
    expect(links[links.length - 1].tabIndex).toBe(0);
    expect(container!.querySelector('button')).toBeNull();
    expect(container!.querySelectorAll('[aria-hidden="true"] > [data-depth="1"]')).toHaveLength(24);
  });

  it('preserves browser-modified heading link activation', async () => {
    renderToc(
      <>
        <h2 id="section-1">Section 1</h2>
        <TableOfContents items={items(4)} />
      </>,
    );
    await flushTocSchedule();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    act(() => container!.querySelector<HTMLAnchorElement>('[data-toc-index="0"]')!.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('does not shift current heading indices when one target is missing', async () => {
    renderToc(
      <>
        <h2 id="section-3">Section 3</h2>
        <TableOfContents items={items(4)} />
      </>,
    );
    await flushTocSchedule();
    expect(container!.querySelector('[aria-current="location"]')?.getAttribute('href')).toBe('#section-3');
  });

  it('tracks vertical geometry without reordering an outline from side-by-side columns', async () => {
    renderToc(
      <>
        {items(4).map((item) => (
          <h2 key={item.id} id={item.id}>
            {item.label}
          </h2>
        ))}
        <TableOfContents items={items(4)} />
      </>,
    );
    [0, 300, 50, 350].forEach((top, index) => {
      vi.spyOn(document.getElementById(`section-${index + 1}`)!, 'getBoundingClientRect').mockReturnValue({
        top,
      } as DOMRect);
    });
    await flushTocSchedule();
    expect(container!.querySelector('[aria-current="location"]')?.getAttribute('href')).toBe('#section-3');
    expect(Array.from(container!.querySelectorAll('[data-toc-index]'), (link) => link.textContent)).toEqual([
      'Section 1',
      'Section 2',
      'Section 3',
      'Section 4',
    ]);
  });

  it('marks the last section current at the document end even when its heading stays below the reading line', async () => {
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')!;
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 });
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(100 + window.innerHeight);
    try {
      renderToc(
        <>
          {items(4).map((item) => (
            <h2 key={item.id} id={item.id}>
              {item.label}
            </h2>
          ))}
          <TableOfContents items={items(4)} />
        </>,
      );
      [-600, -300, -200, 150].forEach((top, index) => {
        vi.spyOn(document.getElementById(`section-${index + 1}`)!, 'getBoundingClientRect').mockReturnValue({
          top,
        } as DOMRect);
      });
      await flushTocSchedule();
      expect(container!.querySelector('[aria-current="location"]')?.getAttribute('href')).toBe('#section-4');
    } finally {
      Object.defineProperty(window, 'scrollY', originalScrollY);
    }
  });

  it('keeps pointer selection open, closes on leaving and resets only outline scroll on reopening', async () => {
    renderToc(
      <>
        <h2 id="section-1">Section 1</h2>
        <TableOfContents items={items(4)} />
      </>,
    );
    await flushTocSchedule();
    const rail = container!.querySelector<HTMLAnchorElement>('[aria-expanded]')!;
    const link = container!.querySelector<HTMLAnchorElement>('[data-toc-index]')!;
    const list = link.closest('ol')!;
    act(() => {
      rail.dispatchEvent(Object.assign(new MouseEvent('pointerover', { bubbles: true }), { pointerType: 'mouse' }));
    });
    expect(list.hidden).toBe(false);
    list.scrollTop = 200;
    act(() => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(list.hidden).toBe(false);
    expect(list.scrollTop).toBe(200);
    act(() => rail.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })));
    expect(list.hidden).toBe(true);
    act(() => {
      rail.dispatchEvent(Object.assign(new MouseEvent('pointerover', { bubbles: true }), { pointerType: 'mouse' }));
    });
    expect(list.scrollTop).toBe(0);
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it('reveals on keyboard focus and dismisses with Escape without moving the document', async () => {
    renderToc(<TableOfContents items={items(4)} />);
    await flushTocSchedule();
    const rail = container!.querySelector<HTMLAnchorElement>('[aria-expanded]')!;
    act(() => rail.focus());
    expect(rail.getAttribute('aria-expanded')).toBe('true');
    act(() => rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(rail.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(rail);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('keeps a focus-opened outline mounted during a touch press so the title can activate', async () => {
    renderToc(
      <>
        <h2 id="section-1">Section 1</h2>
        <TableOfContents items={items(4)} />
      </>,
    );
    await flushTocSchedule();
    const rail = container!.querySelector<HTMLAnchorElement>('[aria-expanded]')!;
    const link = container!.querySelector<HTMLAnchorElement>('[data-toc-index="0"]')!;
    act(() => rail.focus());
    act(() =>
      link.dispatchEvent(
        Object.assign(new MouseEvent('pointerdown', { bubbles: true }), {
          pointerType: 'touch',
        }),
      ),
    );
    expect(link.closest('ol')!.hidden).toBe(false);
    act(() => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
    expect(document.activeElement?.id).toBe('section-1');
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });
});

describe('TableOfContentsView reserved layout', () => {
  it('reserves the outline beside server-rendered children before the deferred outline mounts', async () => {
    renderToc(
      <TableOfContentsView items={items(4)} title="Contents" contentPlacement="center">
        <p id="document">Document</p>
      </TableOfContentsView>,
    );
    const layout = container!.querySelector<HTMLElement>('[data-outline]')!;
    expect(layout.getAttribute('data-placement')).toBe('center');
    expect(layout.querySelector('#document')).not.toBeNull();
    expect(container!.querySelector('[role="navigation"]')).toBeNull();
    await flushTocSchedule();
    expect(layout.querySelector('[role="navigation"]')?.getAttribute('data-presentation')).toBe('rail');
  });

  it('keeps children without reserving space for three or fewer headings', async () => {
    renderToc(
      <TableOfContentsView items={items(3)} title="Contents">
        <p id="document">Document</p>
      </TableOfContentsView>,
    );
    await flushTocSchedule();
    expect(container!.querySelector('#document')).not.toBeNull();
    expect(container!.querySelector('[data-outline]')).toBeNull();
    expect(container!.querySelector('[role="navigation"]')).toBeNull();
  });

  it('presents a labelled persistent column on wide screens', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('>='),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    renderToc(
      <TableOfContentsView items={items(5)} title="Contents">
        <p>Document</p>
      </TableOfContentsView>,
    );
    await flushTocSchedule();
    const navigation = container!.querySelector<HTMLElement>('[role="navigation"]')!;
    expect(navigation.getAttribute('data-presentation')).toBe('column');
    expect(navigation.hasAttribute('aria-label')).toBe(false);
    expect(document.getElementById(navigation.getAttribute('aria-labelledby')!)?.textContent).toBe('Contents');
    expect(navigation.querySelector('[aria-expanded]')).toBeNull();
    expect(navigation.querySelector('ol')!.hidden).toBe(false);
  });

  it('renders a nested list and marks the parents of the current heading', async () => {
    const nested: TocItem[] = [
      { id: 'section-1', label: 'One', level: 2 },
      { id: 'section-2', label: 'Two', level: 3 },
      { id: 'section-3', label: 'Three', level: 4 },
      { id: 'section-4', label: 'Four', level: 6 },
      { id: 'section-5', label: 'Five', level: 2 },
    ];
    renderToc(
      <>
        {nested.map((item) => (
          <h2 key={item.id} id={item.id}>
            {item.label}
          </h2>
        ))}
        <TableOfContentsView items={nested} title="Contents">
          <p>Document</p>
        </TableOfContentsView>
      </>,
    );
    [-300, -200, -100, 50, 400].forEach((top, index) => {
      vi.spyOn(document.getElementById(`section-${index + 1}`)!, 'getBoundingClientRect').mockReturnValue({
        top,
      } as DOMRect);
    });
    await flushTocSchedule();
    const link = (index: number) => container!.querySelector<HTMLAnchorElement>(`[data-toc-index="${index}"]`)!;
    expect(link(3).getAttribute('aria-current')).toBe('location');
    expect([0, 1, 2].map((index) => link(index).hasAttribute('data-ancestor'))).toEqual([true, true, true]);
    expect(link(4).hasAttribute('data-ancestor')).toBe(false);
    expect(link(3).closest('ol')!.closest('li')!.firstElementChild).toBe(link(2));
    // h6 under h4 nests one step deeper, and visual depth stops at the cap.
    expect(link(3).style.getPropertyValue('--_toc-depth')).toBe('2');
    expect(link(1).style.getPropertyValue('--_toc-depth')).toBe('1');
  });
});

describe('TableOfContentsView rail scrubbing', () => {
  async function renderScrubbable() {
    renderToc(
      <>
        {items(5).map((item) => (
          <h2 key={item.id} id={item.id}>
            {item.label}
          </h2>
        ))}
        <TableOfContents items={items(5)} />
      </>,
    );
    await flushTocSchedule();
    const rail = container!.querySelector<HTMLAnchorElement>('[aria-expanded]')!;
    vi.spyOn(rail.firstElementChild!, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      height: 400,
      left: 0,
      right: 24,
      width: 24,
    } as DOMRect);
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({ left: 1000, right: 1044, width: 44 } as DOMRect);
    const pointer = (type: string, clientY: number, clientX = 1020, pointerType = 'touch') => {
      const event = Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }), {
        pointerId: 3,
        pointerType,
      });
      act(() => {
        rail.dispatchEvent(event);
      });
      return event;
    };
    return { rail, pointer, target: () => container!.querySelector('[data-scrub-target]')?.getAttribute('href') };
  }

  it('previews the heading under a touch, follows the finger and navigates on release', async () => {
    const { rail, pointer, target } = await renderScrubbable();
    const current = () => container!.querySelector('[aria-current="location"]')?.getAttribute('href');
    const reading = current();
    const down = pointer('pointerdown', 100);
    expect(down.defaultPrevented).toBe(true);
    expect(rail.getAttribute('aria-expanded')).toBe('true');
    expect(target()).toBe('#section-1');
    pointer('pointermove', 300);
    expect(target()).toBe('#section-3');
    // Scrubbing previews only; the reading location is unchanged until release.
    expect(current()).toBe(reading);
    pointer('pointermove', 520);
    expect(target()).toBe('#section-5');
    pointer('pointerup', 520);
    expect(document.activeElement?.id).toBe('section-5');
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(rail.getAttribute('aria-expanded')).toBe('false');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    act(() => {
      rail.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    expect(rail.getAttribute('aria-expanded')).toBe('false');
  });

  it('cancels without navigating on pointercancel or a far sideways move', async () => {
    const { rail, pointer, target } = await renderScrubbable();
    pointer('pointerdown', 200);
    pointer('pointercancel', 200);
    expect(target()).toBeUndefined();
    expect(rail.getAttribute('aria-expanded')).toBe('false');
    pointer('pointerdown', 200);
    pointer('pointermove', 220, 800);
    pointer('pointerup', 220, 800);
    expect(target()).toBeUndefined();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('starts a mouse scrub only after a drag so a plain click keeps the hover outline', async () => {
    const { rail, pointer, target } = await renderScrubbable();
    // A native link drag would fire pointercancel and abort the scrub.
    expect(rail.getAttribute('draggable')).toBe('false');
    pointer('pointerdown', 200, 1020, 'mouse');
    expect(target()).toBeUndefined();
    pointer('pointerup', 200, 1020, 'mouse');
    expect(scrollIntoView).not.toHaveBeenCalled();
    pointer('pointerdown', 200, 1020, 'mouse');
    pointer('pointermove', 400, 1020, 'mouse');
    expect(target()).toBe('#section-4');
    pointer('pointerup', 400, 1020, 'mouse');
    expect(document.activeElement?.id).toBe('section-4');
  });

  it('cancels a scrub with Escape', async () => {
    const { rail, pointer, target } = await renderScrubbable();
    pointer('pointerdown', 200);
    act(() => {
      rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(target()).toBeUndefined();
    pointer('pointerup', 200);
    expect(scrollIntoView).not.toHaveBeenCalled();
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
    root?.render(<DesignSystemProvider>{node}</DesignSystemProvider>);
  });
}

function TableOfContents({ items }: { items: TocItem[] }) {
  return (
    <TableOfContentsView items={items} title="Contents">
      <p>Document</p>
    </TableOfContentsView>
  );
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
