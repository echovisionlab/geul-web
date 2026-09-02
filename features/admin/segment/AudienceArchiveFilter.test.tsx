// @vitest-environment jsdom

import { act, type ChangeEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudienceArchiveFilter } from './AudienceArchiveFilter';

const mocks = vi.hoisted(() => ({
  pathname: '/admin/audience-segments',
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/core/Input', () => ({
  Switch: ({
    checked,
    label,
    onChange,
  }: {
    checked: boolean;
    label: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  }) => <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} />,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.searchParams = new URLSearchParams();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderFilter() {
  act(() => {
    root.render(<AudienceArchiveFilter />);
  });
  return container.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

describe('AudienceArchiveFilter', () => {
  it('shows archive state from the URL and removes it without disturbing unrelated filters', () => {
    mocks.searchParams = new URLSearchParams('includeArchived=true&status=active');
    const checkbox = renderFilter();

    expect(checkbox.checked).toBe(true);
    act(() => {
      checkbox.click();
    });

    expect(mocks.replace).toHaveBeenCalledWith('/admin/audience-segments?status=active', {
      scroll: false,
    });
  });

  it('enables archive visibility and resets the namespaced table page', () => {
    mocks.searchParams = new URLSearchParams({
      segments: JSON.stringify({ page: 4, pageSize: 20, search: 'members' }),
      status: 'active',
    });
    const checkbox = renderFilter();

    act(() => {
      checkbox.click();
    });

    const [href, options] = mocks.replace.mock.calls[0] as [string, { scroll: boolean }];
    const nextUrl = new URL(href, 'https://studio.example.com');
    expect(nextUrl.pathname).toBe('/admin/audience-segments');
    expect(nextUrl.searchParams.get('includeArchived')).toBe('true');
    expect(nextUrl.searchParams.get('status')).toBe('active');
    expect(JSON.parse(nextUrl.searchParams.get('segments') ?? '{}')).toEqual({
      pageSize: 20,
      search: 'members',
    });
    expect(options).toEqual({ scroll: false });
  });
});
