// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataTableSearch } from './DataTableSearch';
import type { PaginatedQuery } from '@/lib/types/common/query';

const mocks = vi.hoisted(() => ({
  query: {} as PaginatedQuery,
  change: vi.fn(),
  input: undefined as undefined | ComponentProps<'input'>['onChange'],
}));
vi.mock('./DataTableContext', () => ({
  useDataTableContext: () => ({ query: mocks.query, onQueryChange: mocks.change }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => () => 'Search' }));
vi.mock('@/components/core/Input/TextInput', () => ({
  TextInput: ({ leftSection: _icon, ...props }: ComponentProps<'input'> & { leftSection: ReactNode }) => {
    mocks.input = props.onChange;
    return <input {...props} />;
  },
}));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  mocks.change.mockReset();
  vi.useRealTimers();
});
function render() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<DataTableSearch placeholder="Search posts" debounceMs={300} />));
}
async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}
describe('client table search semantics and state', () => {
  it('does not issue an empty query on initial mount and keeps the actual input name', async () => {
    vi.useFakeTimers();
    mocks.query = {};
    render();
    await tick(300);
    expect(mocks.change).not.toHaveBeenCalled();
    expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Search posts');
  });
  it('uses the latest sorts when a typed search finishes and resets the page', async () => {
    vi.useFakeTimers();
    mocks.query = { page: 3 };
    render();
    await act(async () => {
      mocks.input?.({ currentTarget: { value: 'notes' } } as never);
    });
    mocks.query = { page: 3, sorts: [{ field: 'title', direction: 'desc' }] };
    act(() => root.render(<DataTableSearch placeholder="Search posts" debounceMs={300} />));
    await tick(300);
    expect(mocks.change).toHaveBeenCalledExactlyOnceWith({
      page: 1,
      search: 'notes',
      sorts: [{ field: 'title', direction: 'desc' }],
    });
  });
  it('reflects an external reset without pushing the former search back', async () => {
    vi.useFakeTimers();
    mocks.query = { search: 'previous' };
    render();
    mocks.query = {};
    act(() => root.render(<DataTableSearch placeholder="Search posts" debounceMs={300} />));
    expect(host.querySelector('input')?.value).toBe('');
    await tick(300);
    expect(mocks.change).not.toHaveBeenCalled();
  });
});
