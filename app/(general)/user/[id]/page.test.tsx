import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUserLocale: vi.fn(),
  getUserProfileView: vi.fn(),
  getTranslations: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/lib/utils/session.server', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/lib/utils/language.server', () => ({
  getUserLocale: mocks.getUserLocale,
}));

vi.mock('@/lib/queries/user', () => ({
  getUserProfileView: mocks.getUserProfileView,
}));

vi.mock('@/lib/queries/metadata', () => ({
  getSiteMetadataDocument: vi.fn(),
  getMemberMetadataDocument: vi.fn(),
}));

vi.mock('@/lib/utils/og', () => ({
  buildUserOgMetadata: vi.fn(),
}));

vi.mock('@/lib/utils/route-metadata', () => ({
  withNoIndex: vi.fn(),
}));

vi.mock('@/lib/utils/url', () => ({
  joinUrl: vi.fn(),
}));

vi.mock('@/features/user/UserProfileView', () => ({
  UserProfileView: ({ user }: { user: { name: string | null; isAdmin: boolean; isSelf: boolean } }) => (
    <div>
      <span>{user.name}</span>
      <span>{String(user.isAdmin)}</span>
      <span>{String(user.isSelf)}</span>
    </div>
  ),
}));

vi.mock('@/features/user/UserPublishedPostsTable', () => ({
  UserPublishedPostsTable: ({
    memberId,
    requestedLocale,
    searchParams,
  }: {
    memberId: string;
    requestedLocale?: string | null;
    searchParams: URLSearchParams;
  }) => (
    <div>
      <span>table:{memberId}</span>
      <span>locale:{requestedLocale ?? 'null'}</span>
      <span>search:{searchParams.toString()}</span>
    </div>
  ),
  UserPublishedPostsTableFallback: () => <div>loading-table</div>,
}));

describe('UserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTranslations.mockResolvedValue((key: string) => key);
    mocks.notFound.mockImplementation(() => {
      throw new Error('notFound');
    });
  });

  it('renders the public profile route without a session', async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.getUserLocale.mockResolvedValue('ko');
    mocks.getUserProfileView.mockResolvedValue({
      id: 'user-1',
      name: 'Public User',
      image: null,
      bio: 'Hello world',
      role: null,
      banned: false,
      ban_reason: null,
      created_at: null,
      isAdmin: false,
      isSelf: false,
    });

    const module = await import('./page');
    const html = renderToStaticMarkup(
      <MantineProvider>
        {await module.default({
          params: Promise.resolve({ id: 'user-1' }),
          searchParams: Promise.resolve({ 'userPosts.search': 'draft' }),
        })}
      </MantineProvider>,
    );

    expect(mocks.getSession).toHaveBeenCalled();
    expect(mocks.getUserLocale).toHaveBeenCalled();
    expect(mocks.getUserProfileView).toHaveBeenCalledWith(null, null, 'user-1');
    expect(html).toContain('Public User');
    expect(html).toContain('false');
    expect((html.match(/sections\.publishedPosts/g) ?? []).length).toBe(1);
    expect(html).toContain('table:user-1');
    expect(html).toContain('locale:ko');
    expect(html).toContain('search:userPosts.search=draft');
  });
});
