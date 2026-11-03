// @vitest-environment jsdom

import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import enMessages from '@/messages/en.json';
import { AudienceArchiveFilter, AudienceArchiveFilterView } from './AudienceArchiveFilter';

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
beforeEach(() => {
  mocks.replace.mockReset();
  mocks.searchParams = new URLSearchParams();
});

it('shows URL archive state and preserves unrelated filters when disabling it', async () => {
  mocks.searchParams = new URLSearchParams('includeArchived=true&status=active');
  const { user } = render(<AudienceArchiveFilter />);
  const toggle = screen.getByRole('switch', { name: enMessages.adminList.audienceSegments.includeArchived });
  expect(toggle).toBeChecked();
  await user.click(toggle);
  expect(mocks.replace).toHaveBeenCalledWith('/admin/audience-segments?status=active', { scroll: false });
});

it('resets namespaced table paging while preserving its filters', async () => {
  mocks.searchParams = new URLSearchParams({
    segments: JSON.stringify({ page: 4, pageSize: 20, search: 'members' }),
    status: 'active',
  });
  const { user } = render(<AudienceArchiveFilter />);
  await user.click(screen.getByRole('switch'));
  const [href, options] = mocks.replace.mock.calls[0] as [string, { scroll: boolean }];
  const nextUrl = new URL(href, 'https://studio.example.com');
  expect(nextUrl.pathname).toBe('/admin/audience-segments');
  expect(nextUrl.searchParams.get('includeArchived')).toBe('true');
  expect(nextUrl.searchParams.get('status')).toBe('active');
  expect(JSON.parse(nextUrl.searchParams.get('segments') ?? '{}')).toEqual({ pageSize: 20, search: 'members' });
  expect(options).toEqual({ scroll: false });
});

it('keeps the filter visibly pending and blocks another toggle until navigation completes', async () => {
  const change = vi.fn();
  const { user, rerender } = render(<AudienceArchiveFilterView includeArchived={false} pending onChange={change} />);
  expect(screen.getByRole('switch')).toBeDisabled();
  expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByText(enMessages.common.states.loading)).toBeVisible();
  await user.click(screen.getByRole('switch'));
  expect(change).not.toHaveBeenCalled();
  rerender(<AudienceArchiveFilterView includeArchived pending={false} onChange={change} />);
  expect(screen.getByRole('switch')).toBeEnabled();
  expect(screen.queryByText(enMessages.common.states.loading)).not.toBeInTheDocument();
});
