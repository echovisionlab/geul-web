import { useState } from 'react';
import { navigatePreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LayoutContainer } from '@/components/core/Layout';
import { UserProfilePageView } from '@/features/user/UserProfilePageView';
import type { UserProfileViewUser } from '@/features/user/UserProfileView';
import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import { UserPublishedPostsTableView } from '@/features/user/UserPublishedPostsTableView';
import {
  buildUserPublishedPostsFilterFields,
  buildUserPublishedPostsSortFields,
} from '@/features/user/user-published-posts-table-spec';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import { parseTableQuery } from '@/lib/utils/table-url';
import { tableRows } from './fixtures/table-query';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
import type { PublicPostTableRow } from '@/lib/queries/post-table';
const rows: PublicPostTableRow[] = [
  {
    id: 'local-post',
    slug: 'night-signals',
    title: 'Night Signals',
    summary: 'A listening notebook',
    publishedAt: '2026-10-01T00:00:00Z',
    authors: [],
    categories: [{ id: 'local-category', name: 'Listening', slug: 'listening' }],
    tags: [],
  },
];
export function UserProfileFullPreview({
  admin = false,
  state = 'ready',
}: {
  admin?: boolean;
  state?: 'ready' | 'empty' | 'failed' | 'action-failed';
}) {
  const t = useTranslations();
  const [client] = useState(() => new QueryClient());
  const [url, setUrl] = useState('');
  const params = new URLSearchParams(url);
  const query = parseTableQuery(params, 'userPosts');
  const [user, setUser] = useState<UserProfileViewUser>({
    id: 'local-member',
    name: 'June Han',
    image: null,
    bio: 'Field recordings and shared listening.',
    social_links: { github: 'https://github.com/example' },
    role: 'author',
    banned: false,
    ban_reason: null,
    created_at: new Date('2026-10-01T00:00:00Z'),
    isAdmin: admin,
    isSelf: false,
    deleted: false,
  });
  const failed = state === 'action-failed';
  const result = tableRows(
    state === 'empty' ? [] : rows,
    query,
    (row) => row.title ?? '',
    (row, key) => Object.entries(row).find(([k]) => k === key)?.[1],
  );
  return (
    <QueryClientProvider client={client}>
      <ServerDataTableNavigationProvider
        value={{
          pathname: '/user/local-member',
          searchParams: params,
          push: (href) => setUrl(new URL(href, 'https://preview.invalid').search),
          refresh: () => {},
        }}
      >
        <LayoutContainer size="wide" inset="md">
          <UserProfilePageView
            user={user}
            socialLinkEntries={prepareSocialLinksDisplay(user.social_links ?? {})}
            refresh={() => {}}
            navigate={navigatePreview}
            bindings={{
              banUserAction: async (_id, reason) => {
                if (failed) {
                  return actionFailure('Local moderation failed', 'ACTION_FAILED');
                }
                setUser((u) => ({ ...u, banned: true, ban_reason: reason ?? null }));
                return actionSuccess({ success: true as const });
              },
              unbanUserAction: async () => {
                if (failed) {
                  return actionFailure('Local moderation failed', 'ACTION_FAILED');
                }
                setUser((u) => ({ ...u, banned: false, ban_reason: null }));
                return actionSuccess({ success: true as const });
              },
              updateUserAction: async (_id, patch) => {
                if (failed) {
                  return actionFailure('Local role change failed', 'ACTION_FAILED');
                }
                setUser((u) => ({ ...u, role: patch.role ?? u.role }));
                return actionSuccess({ success: true as const });
              },
              deleteUserAction: async () => {
                if (failed) {
                  return actionFailure('Local deletion failed', 'ACTION_FAILED');
                }
                setUser((u) => ({ ...u, deleted: true }));
                return actionSuccess({ success: true as const });
              },
            }}
            publishedPosts={
              <UserPublishedPostsTableView
                result={result}
                emptyMessage={t('userProfile.empty.noPublishedPosts')}
                searchPlaceholder={t('common.placeholders.searchPosts')}
                filterFields={buildUserPublishedPostsFilterFields(
                  { categories: [{ value: 'local-category', label: 'Listening' }], tags: [] },
                  { category: t('common.entities.category'), tag: t('common.entities.tag') },
                )}
                sortFields={buildUserPublishedPostsSortFields({
                  title: t('common.labels.title'),
                  published: t('common.labels.published'),
                })}
                searchParams={params.toString()}
                queryError={state === 'failed' ? 'Local published posts lookup failed' : null}
              />
            }
          />
        </LayoutContainer>
      </ServerDataTableNavigationProvider>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/User/Profile Full Page',
  excludeStories: ['UserProfileFullPreview'],
  component: UserProfileFullPreview,
  args: { admin: false, state: 'ready' },
  render: (args) => <UserProfileFullPreview key={`${args.admin}:${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Production full user profile and published-post table with local query controls and ban/unban/role/delete state. Navigation opens mapped Storybook previews.',
      },
    },
  },
} satisfies Meta<typeof UserProfileFullPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Public: Story = {};
export const Admin: Story = { args: { admin: true } };
export const Empty: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'failed' } };
export const ActionFailed: Story = { args: { admin: true, state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
