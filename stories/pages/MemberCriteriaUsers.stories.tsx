import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { useTranslations } from 'next-intl';
import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { LayoutContainer } from '@/components/core/Layout';
import { UsersPageView } from '@/features/admin/user/UsersPageView';
import { MemberCriteriaPageView } from '@/features/admin/member-criteria/MemberCriteriaPageView';
import type { UserRow } from '@/features/admin/user/UsersTableView';
import type { MemberCriteriaRow } from '@/features/admin/member-criteria/model';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import { parseTableQuery } from '@/lib/utils/table-url';
import { tableRows } from './fixtures/table-query';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
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
const initialCriteriaList: MemberCriteriaRow[] = [
  {
    id: 'local-criteria',
    name: 'All listeners',
    description: 'Local criteria fixture',
    criteria_type: MemberCriteriaKind.ALL_MEMBERS,
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
    criteria_type: MemberCriteriaKind.ALL_MEMBERS,
    estimated_count: 24,
    campaign_count: 0,
    delivery_run_count: 0,
    download_policy_reference_count: 0,
    archived_at: date,
    created_at: date,
  },
];
export function CriteriaUsersPreview({
  domain = 'users',
  state = 'ready',
}: {
  domain?: 'users' | 'memberCriteria';
  state?: 'ready' | 'empty' | 'failed' | 'action-failed';
}) {
  const t = useTranslations('common');
  const tList = useTranslations('adminList.memberCriteria');
  const [users, setUsers] = useState(state === 'empty' ? [] : initialUsers);
  const [criteriaList, setCriteriaList] = useState(state === 'empty' ? [] : initialCriteriaList);
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
    title: t(`entities.${domain === 'users' ? 'users' : 'memberCriteria'}`),
    searchParams: params.toString(),
    filterFields: fields,
    sortFields: fields.map(({ field, label }) => ({ field, label })),
    searchPlaceholder: t('placeholders.search'),
  };
  const error = state === 'action-failed' ? actionFailure('Local operation failed', 'ACTION_FAILED') : undefined;
  const deleteUser = async (id: string) => {
    if (error) {
      return error;
    }
    setUsers((rows) => rows.filter((row) => row.id !== id));
    return actionSuccess({ success: true as const });
  };
  const detail = (row: MemberCriteriaRow) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.criteria_type,
    config: {
      memberTagIds: [],
      accountRoles: [],
      createdAfter: undefined,
      createdBefore: undefined,
      excludeMemberIds: [],
    },
    estimatedCount: row.estimated_count,
    archivedAt: row.archived_at,
  });
  return (
    <ServerDataTableNavigationProvider
      value={{
        pathname: `/admin/${domain === 'users' ? 'users' : 'criteria-criteriaList'}`,
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
                  return actionSuccess({ success: true as const });
                },
                updateUserAction: async (id, patch) => {
                  if (error) {
                    return error;
                  }
                  setUsers((rows) =>
                    rows.map((row) => (row.id === id ? { ...row, role: patch.role ?? row.role } : row)),
                  );
                  return actionSuccess({ success: true as const });
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
          <MemberCriteriaPageView
            {...shared}
            description={tList('description')}
            result={result(criteriaList.filter((row) => !row.archived_at || params.get('includeArchived') === 'true'))}
            modalBindings={{
              refresh: () => {},
              bindings: {
                createMemberCriteriaAction: async (input) => {
                  if (error) {
                    return error;
                  }
                  const id = `local-criteria-${criteriaList.length}`;
                  setCriteriaList((rows) => [
                    ...rows,
                    {
                      ...initialCriteriaList[0],
                      id,
                      name: input.name,
                      description: input.description ?? '',
                      criteria_type: input.kind,
                    },
                  ]);
                  return actionSuccess({ data: { id } });
                },
                getMemberCriteriaAction: async (id) => {
                  if (error) {
                    return error;
                  }
                  const row = criteriaList.find((row) => row.id === id);
                  return row ? actionSuccess({ data: detail(row) }) : actionFailure('Not found', 'ACTION_FAILED');
                },
                updateMemberCriteriaAction: async (input) => {
                  if (error) {
                    return error;
                  }
                  const row = criteriaList.find((row) => row.id === input.id);
                  if (!row) {
                    return actionFailure('Not found', 'ACTION_FAILED');
                  }
                  const updated = {
                    ...row,
                    name: input.name ?? row.name,
                    description: input.description ?? row.description,
                    criteria_type: input.kind ?? row.criteria_type,
                  };
                  setCriteriaList((rows) => rows.map((row) => (row.id === input.id ? updated : row)));
                  return actionSuccess({ data: detail(updated) });
                },
                archiveMemberCriteriaAction: async (id) => {
                  if (error) {
                    return error;
                  }
                  setCriteriaList((rows) => rows.map((row) => (row.id === id ? { ...row, archived_at: date } : row)));
                  return actionSuccess({ success: true as const });
                },
                restoreMemberCriteriaAction: async (id) => {
                  if (error) {
                    return error;
                  }
                  setCriteriaList((rows) => rows.map((row) => (row.id === id ? { ...row, archived_at: null } : row)));
                  return actionSuccess({ success: true as const });
                },
                countMatchingMembersAction: async () => error ?? actionSuccess({ count: 82 }),
              },
            }}
          />
        )}
      </LayoutContainer>
    </ServerDataTableNavigationProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Member Criteria and Users',
  excludeStories: ['CriteriaUsersPreview'],
  component: CriteriaUsersPreview,
  args: { domain: 'users', state: 'ready' },
  render: (args) => <CriteriaUsersPreview key={`${args.domain}:${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual production PageViews and original user/criteria modal controllers with typed local actions. Search/selection/ban/role/unsubscribe and criteria estimate/archive/restore exercise actual UI. No account, role, newsletter or criteria changes reach a backend. Server authorization, config evaluation and persistence remain outside.',
      },
    },
  },
} satisfies Meta<typeof CriteriaUsersPreview>;
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
export const MemberCriteria: Story = { args: { domain: 'memberCriteria' } };
export const MemberCriteriaEmpty: Story = { args: { domain: 'memberCriteria', state: 'empty' } };
export const MemberCriteriaFailed: Story = { args: { domain: 'memberCriteria', state: 'failed' } };
export const MemberCriteriaActionFailed: Story = { args: { domain: 'memberCriteria', state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
