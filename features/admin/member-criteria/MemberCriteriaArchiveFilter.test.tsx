// @vitest-environment jsdom

import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import enMessages from '@/messages/en.json';
import { MemberCriteriaArchiveFilter, MemberCriteriaArchiveFilterView } from './MemberCriteriaArchiveFilter';

const mocks = vi.hoisted(() => ({
  pathname: '/admin/member-criteria',
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
  const { user } = render(<MemberCriteriaArchiveFilter />);
  const toggle = screen.getByRole('switch', { name: enMessages.adminList.memberCriteria.includeArchived });
  expect(toggle).toBeChecked();
  await user.click(toggle);
  expect(mocks.replace).toHaveBeenCalledWith('/admin/member-criteria?status=active', { scroll: false });
});

it('resets namespaced table paging while preserving its filters', async () => {
  mocks.searchParams = new URLSearchParams({
    memberCriteria: JSON.stringify({ page: 4, pageSize: 20, search: 'members' }),
    status: 'active',
  });
  const { user } = render(<MemberCriteriaArchiveFilter />);
  await user.click(screen.getByRole('switch'));
  const [href, options] = mocks.replace.mock.calls[0] as [string, { scroll: boolean }];
  const nextUrl = new URL(href, 'https://studio.example.com');
  expect(nextUrl.pathname).toBe('/admin/member-criteria');
  expect(nextUrl.searchParams.get('includeArchived')).toBe('true');
  expect(nextUrl.searchParams.get('status')).toBe('active');
  expect(JSON.parse(nextUrl.searchParams.get('memberCriteria') ?? '{}')).toEqual({ pageSize: 20, search: 'members' });
  expect(options).toEqual({ scroll: false });
});

it('keeps the filter visibly pending and blocks another toggle until navigation completes', async () => {
  const change = vi.fn();
  const { user, rerender } = render(
    <MemberCriteriaArchiveFilterView includeArchived={false} pending onChange={change} />,
  );
  expect(screen.getByRole('switch')).toBeDisabled();
  expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByText(enMessages.common.states.loading)).toBeVisible();
  await user.click(screen.getByRole('switch'));
  expect(change).not.toHaveBeenCalled();
  rerender(<MemberCriteriaArchiveFilterView includeArchived pending={false} onChange={change} />);
  expect(screen.getByRole('switch')).toBeEnabled();
  expect(screen.queryByText(enMessages.common.states.loading)).not.toBeInTheDocument();
});
