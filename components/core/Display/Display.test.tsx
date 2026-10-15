// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, describe, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar, ScrollArea, Separator, Skeleton, Spinner, Table, type AvatarProps } from './Display';
import { Pagination, type PaginationLabels } from './Pagination';
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
  act(() => root.render(node));
}
describe('native Core Display contracts', () => {
  it('rejects unsupported row divider policies', () => {
    expect(() => render(<Table rowDividers={'custom' as 'all'} />)).toThrow('Invalid table row dividers');
  });

  it('keeps a semantic table and explicit content widths, cell span, alignment and shared row states', () => {
    render(
      <Table bordered striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th width={120} align="end">
              Amount
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr disabled dimmed dragState={{ transform: 'translateY(10px)', dragging: true }}>
            <Table.Td colSpan={2}>Value</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>,
    );
    expect(container.querySelector('table')?.dataset.bordered).toBe('true');
    expect(container.querySelector('th')?.scope).toBe('col');
    expect(container.querySelector('th')?.style.width).toBe('120px');
    expect(container.querySelector('th')?.dataset.align).toBe('end');
    expect(container.querySelector('td')?.colSpan).toBe(2);
    const row = container.querySelector('tbody tr') as HTMLElement;
    expect(row.dataset.disabled).toBe('true');
    expect(row.dataset.dimmed).toBe('true');
    expect(row.style.transform).toBe('translateY(10px)');
  });
  it('uses the avatar fallback when authored media fails and recovers when its source changes', () => {
    render(
      <Avatar src="/broken.png" alt="Artist" size="sm">
        AR
      </Avatar>,
    );
    act(() => container.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('AR');
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Artist');
    render(
      <Avatar src="/other.png" alt="Artist">
        AR
      </Avatar>,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/other.png');
  });
  it('projects only native affordances and refuses caller presentation even across a runtime cast', () => {
    const unsafe = {
      style: { color: 'red' },
      className: 'local',
      styles: { root: {} },
      'data-testid': 'avatar',
      'data-core-tone': 'danger',
    } as unknown as AvatarProps;
    render(<Avatar {...unsafe}>A</Avatar>);
    const avatar = container.querySelector('[data-testid="avatar"]') as HTMLElement;
    expect(avatar.style.color).toBe('');
    expect(avatar.className).not.toContain('local');
    expect(avatar.hasAttribute('data-core-tone')).toBe(false);
  });
  it('renders named progress and decorative skeletons with finite owner variants', () => {
    render(
      <>
        <Spinner size="xs" aria-label="Loading files" />
        <Skeleton roleType="media" width="long" />
        <Separator label="Details" labelPosition="start" orientation="horizontal" />
      </>,
    );
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading files');
    expect(container.querySelector('[data-role="media"]')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[role="separator"]')?.getAttribute('aria-orientation')).toBe('horizontal');
  });
  it('gives scrollable content a keyboard focus target while Core owns its inset and limit', () => {
    render(
      <ScrollArea.Autosize size="compact" inset="sm" aria-label="Commands">
        Content
      </ScrollArea.Autosize>,
    );
    const area = container.querySelector('[aria-label="Commands"]') as HTMLElement;
    expect(area.tabIndex).toBe(0);
    expect(area.dataset.limit).toBe('compact');
    expect(area.dataset.inset).toBe('sm');
  });
  it('retains a named keyboard-focusable table region without forwarding presentation overrides', () => {
    const unsafe = { style: { background: 'red' }, className: 'foreign' } as unknown as ComponentProps<
      typeof Table.ScrollContainer
    >;
    render(
      <Table.ScrollContainer {...unsafe} minWidth={640} role="region" aria-label="Submissions" tabIndex={0}>
        <Table>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>Submission</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>,
    );
    const region = container.querySelector('[role="region"]') as HTMLElement;
    expect(region.getAttribute('aria-label')).toBe('Submissions');
    expect(region.tabIndex).toBe(0);
    region.focus();
    expect(document.activeElement).toBe(region);
    expect(region.style.background).toBe('');
    expect(region.className).not.toContain('foreign');
    expect((region.firstElementChild as HTMLElement).style.minWidth).toBe('640px');
  });
  it('uses translated page names, selected state and disabled bounds with finite visible pages', () => {
    const change = vi.fn();
    render(
      <Pagination
        value={1}
        total={99}
        onChange={change}
        labels={{ previousPage: 'Previous page', nextPage: 'Next page', page: (page) => `Page ${page}` }}
      />,
    );
    const previous = container.querySelector('[aria-label="Previous page"]') as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(container.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe('Page 1');
    expect(container.querySelectorAll('button').length).toBeLessThan(12);
    act(() => (container.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click());
    expect(change).toHaveBeenCalledExactlyOnceWith(2);
  });

  it.each([
    { value: 2.7, total: 5.2, expected: 2 },
    { value: Number.NaN, total: 5, expected: 1 },
    { value: 2, total: Number.NaN, expected: 1 },
    { value: Number.POSITIVE_INFINITY, total: Number.POSITIVE_INFINITY, expected: 1 },
  ])('keeps one finite integer current page for value=$value total=$total', ({ value, total, expected }) => {
    const change = vi.fn();
    render(
      <Pagination
        value={value}
        total={total}
        onChange={change}
        labels={{ previousPage: 'Previous page', nextPage: 'Next page', page: (page) => `Page ${page}` }}
      />,
    );
    const current = container.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe(String(expected));
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('Infinity');
    act(() => (container.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click());
    expect(change.mock.calls.every(([page]) => Number.isFinite(page) && Number.isInteger(page))).toBe(true);
  });

  describe('link mode', () => {
    const labels: PaginationLabels = {
      firstPage: 'First page',
      previousPage: 'Previous page',
      page: (page) => `Page ${page}`,
      nextPage: 'Next page',
      lastPage: 'Last page',
    };
    const getHref = (page: number) => `/list?page=${page}`;
    const hrefOf = (label: string) =>
      container.querySelector<HTMLAnchorElement>(`a[aria-label="${label}"]`)?.getAttribute('href');

    it('renders every reachable page, step and bound as an anchor with the same range and ellipses', () => {
      render(<Pagination aria-label="Results pages" value={5} total={10} getHref={getHref} labels={labels} />);
      const nav = container.querySelector('nav')!;
      expect(nav.getAttribute('aria-label')).toBe('Results pages');
      expect(nav.querySelectorAll('button')).toHaveLength(0);
      expect([...nav.querySelectorAll('a')].map((link) => link.getAttribute('aria-label'))).toEqual([
        'First page',
        'Previous page',
        'Page 1',
        'Page 3',
        'Page 4',
        'Page 5',
        'Page 6',
        'Page 7',
        'Page 10',
        'Next page',
        'Last page',
      ]);
      expect(hrefOf('First page')).toBe('/list?page=1');
      expect(hrefOf('Previous page')).toBe('/list?page=4');
      expect(hrefOf('Page 7')).toBe('/list?page=7');
      expect(hrefOf('Next page')).toBe('/list?page=6');
      expect(hrefOf('Last page')).toBe('/list?page=10');
      const current = nav.querySelectorAll('[aria-current="page"]');
      expect(current).toHaveLength(1);
      expect(current[0].tagName).toBe('A');
      expect(current[0].getAttribute('href')).toBe('/list?page=5');
      expect(current[0].textContent).toBe('5');
      const gaps = nav.querySelectorAll('[aria-hidden="true"]:not(svg)');
      expect([...gaps].map((gap) => gap.textContent)).toEqual(['…', '…']);
    });

    it.each([
      { value: 1, disabled: ['First page', 'Previous page'], linked: ['Next page', 'Last page'] },
      { value: 3, disabled: ['Next page', 'Last page'], linked: ['First page', 'Previous page'] },
    ])('renders bounds at page $value as disabled non-link items', ({ value, disabled, linked }) => {
      render(<Pagination value={value} total={3} getHref={getHref} labels={labels} />);
      for (const label of disabled) {
        const bound = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
        expect(bound.tagName).toBe('BUTTON');
        expect(bound.disabled).toBe(true);
        expect(bound.hasAttribute('href')).toBe(false);
      }
      for (const label of linked) {
        expect(hrefOf(label)).toMatch(/^\/list\?page=\d$/);
      }
    });

    it('omits first/last controls when their labels are absent', () => {
      render(
        <Pagination
          value={2}
          total={3}
          getHref={getHref}
          labels={{ previousPage: 'Previous page', nextPage: 'Next page', page: (page) => `Page ${page}` }}
        />,
      );
      expect(container.querySelector('[aria-label="First page"]')).toBeNull();
      expect(container.querySelector('[aria-label="Last page"]')).toBeNull();
      expect(container.querySelectorAll('a')).toHaveLength(5);
    });

    it('reports ordinary clicks to onNavigate and keeps native intent for modified clicks', () => {
      const navigate = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
      render(<Pagination value={2} total={5} getHref={getHref} labels={labels} onNavigate={navigate} />);
      const next = container.querySelector<HTMLAnchorElement>('a[aria-label="Next page"]')!;
      const modified = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
      act(() => next.dispatchEvent(modified));
      expect(navigate).not.toHaveBeenCalled();
      expect(modified.defaultPrevented).toBe(false);
      const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      act(() => container.querySelector('a[aria-label="Page 4"]')!.dispatchEvent(plain));
      expect(navigate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ page: 4, href: '/list?page=4' }));
      expect(plain.defaultPrevented).toBe(true);
    });

    it('server-renders plain anchors without client state', () => {
      const markup = renderToStaticMarkup(<Pagination value={2} total={3} getHref={getHref} labels={labels} />);
      const nav = new DOMParser().parseFromString(markup, 'text/html').querySelector('nav')!;
      expect([...nav.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
        '/list?page=1',
        '/list?page=1',
        '/list?page=1',
        '/list?page=2',
        '/list?page=3',
        '/list?page=3',
        '/list?page=3',
      ]);
      expect(nav.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe('/list?page=2');
    });
  });
});
