import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { useTranslations } from 'next-intl';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { LayoutContainer } from '@/components/core/Layout';
import { UsersPageView } from '@/features/admin/user/UsersPageView';
import { SegmentsPageView } from '@/features/admin/segment/SegmentsPageView';
import type { UserRow } from '@/features/admin/user/UsersTableView';
import type { AudienceSegmentRow } from '@/features/admin/segment/model';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import { parseTableQuery } from '@/lib/utils/table-url';
import { tableRows } from './fixtures/table-query';
const date = new Date('2026-10-01T00:00:00Z');
const initialUsers: UserRow[] = [
  {
    id: 'local-user',
    email: 'june@example.com',
    nickname: 'June Han',
    image: null,
    role: 'author',
    status: 'active',
    banned: false,
    onboarded: true,
    newsletter_subscribed: true,
    newsletter_subscribed_at: date,
    created_at: date,
  },
  {
    id: 'local-reader',
    email: null,
    nickname: 'Studio reader',
    image: null,
    role: 'user',
    status: 'active',
    banned: false,
    onboarded: true,
    newsletter_subscribed: false,
    newsletter_subscribed_at: null,
    created_at: date,
  },
  {
    // Until onboarding the API stores the member UUID as a placeholder nickname.
    id: '7c1d4f3e-2a9b-4c8d-9e0f-1a2b3c4d5e6f',
    email: 'new.member@example.com',
    nickname: '7c1d4f3e-2a9b-4c8d-9e0f-1a2b3c4d5e6f',
    image: null,
    role: 'user',
    status: 'active',
    banned: false,
    onboarded: false,
    newsletter_subscribed: false,
    newsletter_subscribed_at: null,
    created_at: date,
  },
];
const initialSegments: AudienceSegmentRow[] = [
  {
    id: 'local-segment',
    name: 'All listeners',
    description: 'Local audience fixture',
    segment_type: SegmentType.ALL_MEMBERS,
    segment_type_label: 'All members',
    estimated_count: 82,
    campaign_count: 1,
    delivery_run_count: 0,
    download_policy_reference_count: 0,
    archived_at: null,
    created_at: date,
  },
  {
    id: 'local-archived',
    name: 'Previous listeners',
    description: 'Archived local fixture',
    segment_type: SegmentType.ALL_MEMBERS,
    segment_type_label: 'All members',
    estimated_count: 24,
    campaign_count: 0,
    delivery_run_count: 0,
    download_policy_reference_count: 0,
    archived_at: date,
    created_at: date,
  },
];
export function AudienceUsersPreview({
  domain = 'users',
  state = 'ready',
}: {
  domain?: 'users' | 'segments';
  state?: 'ready' | 'empty' | 'failed' | 'action-failed';
}) {
  const t = useTranslations('common');
  const [users, setUsers] = useState(state === 'empty' ? [] : initialUsers);
  const [segments, setSegments] = useState(state === 'empty' ? [] : initialSegments);
  const [url, setUrl] = useState('');
  const params = new URLSearchParams(url);
  const query = parseTableQuery(params, domain);
  const fields = [
    { field: domain === 'users' ? 'nickname' : 'name', label: t('labels.name'), type: 'string' as const },
  ];
  const result = <T extends { id: string }>(rows: T[]) => ({
    ...tableRows(
      rows,
      query,
      (row) =>
        Object.values(row)
          .filter((v) => typeof v === 'string')
          .join(' '),
      (row, key) => Object.entries(row).find(([k]) => k === key)?.[1],
    ),
    ...(state === 'failed' ? { error: t('messages.failedToLoad') } : {}),
  });
  const shared = {
    title: t(`entities.${domain === 'users' ? 'users' : 'audienceSegments'}`),
    searchParams: params.toString(),
    filterFields: fields,
    sortFields: fields.map(({ field, label }) => ({ field, label })),
    searchPlaceholder: t('placeholders.search'),
  };
  const error = state === 'action-failed' ? { error: 'Local operation failed' } : undefined;
  const deleteUser = async (id: string) => {
    if (error) {
      return error;
    }
    setUsers((rows) => rows.filter((row) => row.id !== id));
    return { success: true };
  };
  const detail = (row: AudienceSegmentRow) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    segmentType: row.segment_type,
    config: { memberTagIds: [], accountRoles: [], excludeMemberIds: [] },
    estimatedCount: row.estimated_count,
    archivedAt: row.archived_at,
  });
  return (
    <ServerDataTableNavigationProvider
      value={{
        pathname: `/admin/${domain === 'users' ? 'users' : 'audience-segments'}`,
        searchParams: params,
        push: (href) => setUrl(new URL(href, 'https://preview.invalid').search),
        refresh: () => {},
      }}
    >
      <LayoutContainer size="wide" inset="md">
        {domain === 'users' ? (
          <UsersPageView
            {...shared}
            result={result(users)}
            deleteAction={deleteUser}
            modalBindings={{
              refresh: () => {},
              bindings: {
                deleteUserAction: deleteUser,
                banUserAction: async (id) => {
                  if (error) {
                    return error;
                  }
                  setUsers((rows) =>
                    rows.map((row) => (row.id === id ? { ...row, banned: true, status: 'banned' } : row)),
                  );
                  return { success: true };
                },
                updateUserAction: async (id, patch) => {
                  if (error) {
                    return error;
                  }
                  setUsers((rows) =>
                    rows.map((row) => (row.id === id ? { ...row, role: patch.role ?? row.role } : row)),
                  );
                  return { success: true };
                },
                unsubscribeUserFromNewsletterAction: async (id) => {
                  if (error) {
                    return { success: false, message: error.error };
                  }
                  setUsers((rows) =>
                    rows.map((row) =>
                      row.id === id ? { ...row, newsletter_subscribed: false, newsletter_subscribed_at: null } : row,
                    ),
                  );
                  return { success: true, message: 'Local subscription removed' };
                },
              },
            }}
          />
        ) : (
          <SegmentsPageView
            {...shared}
            description="Audience management"
            result={result(segments.filter((row) => !row.archived_at || params.get('includeArchived') === 'true'))}
            modalBindings={{
              refresh: () => {},
              bindings: {
                createSegmentAction: async (input) => {
                  if (error) {
                    return error;
                  }
                  const id = `local-segment-${segments.length}`;
                  setSegments((rows) => [
                    ...rows,
                    {
                      ...initialSegments[0],
                      id,
                      name: input.name,
                      description: input.description ?? '',
                      segment_type: input.segmentType,
                    },
                  ]);
                  return { data: { id } };
                },
                getSegmentAction: async (id) => {
                  if (error) {
                    return error;
                  }
                  const row = segments.find((row) => row.id === id);
                  return row ? { data: detail(row) } : { error: 'Not found' };
                },
                updateSegmentAction: async (input) => {
                  if (error) {
                    return error;
                  }
                  const row = segments.find((row) => row.id === input.id);
                  if (!row) {
                    return { error: 'Not found' };
                  }
                  const updated = {
                    ...row,
                    name: input.name ?? row.name,
                    description: input.description ?? row.description,
                    segment_type: input.segmentType ?? row.segment_type,
                  };
                  setSegments((rows) => rows.map((row) => (row.id === input.id ? updated : row)));
                  return { data: detail(updated) };
                },
                archiveSegmentAction: async (id) => {
                  if (error) {
                    return error;
                  }
                  setSegments((rows) => rows.map((row) => (row.id === id ? { ...row, archived_at: date } : row)));
                  return { success: true };
                },
                restoreSegmentAction: async (id) => {
                  if (error) {
                    return error;
                  }
                  setSegments((rows) => rows.map((row) => (row.id === id ? { ...row, archived_at: null } : row)));
                  return { success: true };
                },
                estimateSegmentCountAction: async () => error ?? { count: 82 },
              },
            }}
          />
        )}
      </LayoutContainer>
    </ServerDataTableNavigationProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Audience and Users',
  excludeStories: ['AudienceUsersPreview'],
  component: AudienceUsersPreview,
  args: { domain: 'users', state: 'ready' },
  render: (args) => <AudienceUsersPreview key={`${args.domain}:${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual production PageViews and original user/segment modal controllers with typed local actions. Search/selection/ban/role/unsubscribe and segment estimate/archive/restore exercise actual UI. No account, role, newsletter or audience changes reach a backend. Server authorization, config evaluation and persistence remain outside.',
      },
    },
  },
} satisfies Meta<typeof AudienceUsersPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Users: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/^(Nickname not set|닉네임 미설정)$/u)).toBeVisible();
    await expect(canvas.queryByText('7c1d4f3e-2a9b-4c8d-9e0f-1a2b3c4d5e6f')).toBeNull();
  },
};
export const UsersEmpty: Story = { args: { state: 'empty' } };
export const UsersFailed: Story = { args: { state: 'failed' } };
export const UsersActionFailed: Story = { args: { state: 'action-failed' } };
export const Segments: Story = { args: { domain: 'segments' } };
export const SegmentsEmpty: Story = { args: { domain: 'segments', state: 'empty' } };
export const SegmentsFailed: Story = { args: { domain: 'segments', state: 'failed' } };
export const SegmentsActionFailed: Story = { args: { domain: 'segments', state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
