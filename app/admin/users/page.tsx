import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { UserModalProvider, UserModals, UsersTableContent } from '@/features/admin/user';
import { listUsersAdminAction } from '@/lib/actions/user';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tNickname = await getTranslations('nicknameField');
  const usersLabel = tCommon('entities.users');
  const searchPlaceholder = tCommon('actions.searchItems', { items: usersLabel.toLowerCase() });
  const filterFields: FilterFieldConfig[] = [
    {
      field: 'nickname',
      label: tNickname('label'),
      type: 'string',
      operators: ['eq', 'ne', 'like', 'ilike'],
    },
    {
      field: 'role',
      label: tCommon('labels.role'),
      type: 'string',
      operators: ['eq', 'ne', 'in'],
      options: [
        { value: 'user', label: tCommon('roles.user') },
        { value: 'author', label: tCommon('roles.author') },
        { value: 'admin', label: tCommon('roles.admin') },
      ],
    },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      operators: ['eq', 'ne', 'in'],
      options: [
        { value: 'active', label: tCommon('statuses.active') },
        { value: 'banned', label: tCommon('statuses.banned') },
        { value: 'pending_deletion', label: tCommon('statuses.pendingDeletion') },
        { value: 'deleted', label: tCommon('statuses.deleted') },
      ],
    },
    {
      field: 'newsletter_subscribed',
      label: tCommon('labels.newsletter'),
      type: 'boolean',
      operators: ['eq'],
    },
    {
      field: 'created_at',
      label: tCommon('labels.joined'),
      type: 'date',
      operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
    },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'nickname', label: tNickname('label') },
    { field: 'email', label: tCommon('labels.email') },
    { field: 'role', label: tCommon('labels.role') },
    { field: 'newsletter_subscribed', label: tCommon('labels.newsletter') },
    { field: 'created_at', label: tCommon('labels.joined') },
  ];

  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'users');
  const result = await listUsersAdminAction({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filter: query.filters,
  });

  return (
    <UserModalProvider>
      <AdminPageHeader title={usersLabel} />

      <ServerDataTable namespace="users">
        <UsersTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTable.Pagination namespace="users" result={result} searchParams={params} />
      </ServerDataTable>

      <UserModals />
    </UserModalProvider>
  );
}
