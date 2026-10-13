'use client';

import { ConfirmationDialog } from '@/features/confirmation';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconEdit, IconPlus, IconStar, IconStarOff, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, StatusIcon } from '@/components/core/Display';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { DataTableSelectableSection } from '@/features/data-table/DataTableSelectableSection';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { createWorkAction, deleteWorkAction, listWorksAdminAction } from '@/lib/actions/work';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { WORK_TYPE_LABELS, type WorkType } from '@/lib/types/work/model';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

/**
 * Work list item type matching the return value from listWorksAdminAction
 */
interface AdminWorkListItem {
  id: string;
  title: string;
  slug: string | null;
  type: string;
  featuredImageUrl: string | null;
  featured: boolean;
  status: string;
  creditCount: number;
  clientCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface WorksPageViewProps {
  listAction?: typeof listWorksAdminAction;
  createAction?: typeof createWorkAction;
  deleteAction?: typeof deleteWorkAction;
  onCreated?: (id: string) => void;
}
export function WorksPageView({
  listAction = listWorksAdminAction,
  createAction = createWorkAction,
  deleteAction = deleteWorkAction,
  onCreated,
}: WorksPageViewProps = {}) {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const tDataTable = useTranslations('dataTable.aria');
  const tWorks = useTranslations('works');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isNavigating, startNavigation] = useTransition();
  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: 20,
  });

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [selectedWork, setSelectedWork] = useState<AdminWorkListItem | null>(null);

  const filterFields: FilterFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title'), type: 'string' },
    {
      field: 'type',
      label: tCommon('labels.type'),
      type: 'string',
      options: [
        { value: 'music_project', label: tWorks('types.music_project') },
        { value: 'portfolio', label: tWorks('types.portfolio') },
        { value: 'article', label: tWorks('types.article') },
        { value: 'contribution', label: tWorks('types.contribution') },
      ],
    },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: 'draft', label: tCommon('statuses.draft') },
        { value: 'published', label: tCommon('statuses.published') },
      ],
    },
    { field: 'featured', label: tCommon('labels.featured'), type: 'boolean' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
    { field: 'updated_at', label: tCommon('labels.updated'), type: 'date' },
    { field: 'published_at', label: tCommon('labels.published'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title') },
    { field: 'type', label: tCommon('labels.type') },
    { field: 'status', label: tCommon('labels.status') },
    { field: 'sort_order', label: tCommon('labels.order') },
    { field: 'created_at', label: tCommon('labels.created') },
    { field: 'updated_at', label: tCommon('labels.updated') },
    { field: 'published_at', label: tCommon('labels.published') },
  ];

  const loadedDataQuery = useQuery({
    queryKey: ['works', 'admin', query],
    queryFn: () =>
      listAction({
        filter: query.filters as never,
        filterBy: (query.filterBy || 'AND') as 'AND' | 'OR',
        sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })) as never,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
      }).then(unwrapQueryResult),
  });
  const { data, isLoading } = loadedDataQuery;

  const invalidateWorks = () => queryClient.invalidateQueries({ queryKey: ['works'] });

  const createWork = useMutation({
    mutationFn: () => {
      const now = new Date();
      return createAction({
        title: 'Untitled Work',
        type: 'portfolio',
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        untilYear: now.getFullYear(),
        untilMonth: now.getMonth() + 1,
        isPresent: false,
      });
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.data) {
        void invalidateWorks();
        if (onCreated) {
          onCreated(result.data.id);
          return;
        }
        const href = `/works/${result.data.id}?edit=true`;
        startNavigation(() => {
          router.push(href);
        });
      }
    },
  });

  const deleteWork = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteAction(id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.work').toLowerCase() }),
        tone: 'positive',
      });
      void invalidateWorks();
      closeDeleteModal();
    },
  });

  const handleCreate = () => {
    createWork.mutate();
  };

  const handleDelete = (work: AdminWorkListItem) => {
    setSelectedWork(work);
    openDeleteModal();
  };

  useEffect(() => {
    if (!deleteModalOpened) {
      setSelectedWork(null);
    }
  }, [deleteModalOpened]);

  const columns: ColumnDef<AdminWorkListItem>[] = [
    {
      key: 'title',
      header: tCommon('entities.work'),
      cell: (row) => (
        <DsLayoutInline gap="sm">
          <Avatar
            src={buildManagedImageUrl(row.featuredImageUrl, MANAGED_IMAGE_PRESET.COVER_THUMB)}
            size="sm"
            shape="square"
            name={row.title}
          />
          <DsLayoutStack gap="xxs">
            <TextButton href={`/works/${row.id}?edit=true`} size="sm" weight="medium" appearance="accent">
              {row.title || tCommon('states.untitled')}
            </TextButton>
            {row.slug && (
              <DsText size="xs" tone="secondary">
                /{row.slug}
              </DsText>
            )}
          </DsLayoutStack>
        </DsLayoutInline>
      ),
    },
    {
      key: 'type',
      header: tCommon('labels.type'),
      cell: (row) => {
        const normalizedType = normalizeEnumToken(row.type) as WorkType;
        let typeLabel = WORK_TYPE_LABELS[normalizedType] || row.type;

        switch (normalizedType) {
          case 'music_project':
          case 'portfolio':
          case 'article':
          case 'contribution':
            typeLabel = tWorks(`types.${normalizedType}`);
            break;
          default:
            break;
        }

        return (
          <LabelBadge tone="neutral" size="sm">
            {typeLabel}
          </LabelBadge>
        );
      },
    },
    {
      key: 'status',
      header: tCommon('labels.status'),
      cell: (row) => (
        <StatusBadge tone={normalizeEnumToken(row.status) === 'published' ? 'positive' : 'neutral'} size="sm">
          {normalizeEnumToken(row.status) === 'published'
            ? tCommon('statuses.published')
            : normalizeEnumToken(row.status) === 'draft'
              ? tCommon('statuses.draft')
              : row.status || tCommon('statuses.draft')}
        </StatusBadge>
      ),
    },
    {
      key: 'featured',
      header: tCommon('labels.featured'),
      cell: (row) =>
        row.featured ? <StatusIcon icon={IconStar} tone="accent" /> : <StatusIcon icon={IconStarOff} tone="neutral" />,
    },
    {
      key: 'createdAt',
      header: tCommon('labels.created'),
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          <DateTime value={row.createdAt} />
        </DsText>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => {
        const items: TableRowMenuItem[] = [
          {
            label: tCommon('actions.edit'),
            icon: <IconEdit size={16} />,
            onClick: () => router.push(`/works/${row.id}?edit=true`),
          },
          {
            label: tCommon('actions.delete'),
            icon: <IconTrash size={16} />,
            tone: 'danger',
            onClick: () => handleDelete(row),
          },
        ];

        return (
          <TableRowMenu
            aria-label={tDataTable('rowActions', {
              label: row.title || tCommon('entities.work').toLowerCase(),
            })}
            items={items}
          />
        );
      },
    },
  ];

  if (loadedDataQuery.isError && loadedDataQuery.data === undefined) {
    return <QueryErrorAlert queries={[loadedDataQuery]} />;
  }
  return (
    <>
      <QueryErrorAlert queries={[loadedDataQuery]} />

      <AdminPageHeader
        title={tCommon('entities.works')}
        items={[
          {
            key: 'create-work',
            type: 'action',
            label: tCommon('actions.newItem', { item: tCommon('entities.work') }),
            icon: <IconPlus size={16} />,
            onClick: handleCreate,
            loading: createWork.isPending || isNavigating,
            disabled: createWork.isPending || isNavigating,
          },
        ]}
      />

      <DataTableSelectableSection
        columns={columns}
        result={data}
        loading={isLoading}
        query={query}
        getRowKey={(row) => row.id}
        onQueryChange={setQuery}
        emptyMessage={tCommon('messages.noWorksFound')}
        searchPlaceholder={tCommon('actions.searchItems', {
          items: tCommon('entities.works').toLowerCase(),
        })}
        filterFields={filterFields}
        sortFields={sortFields}
        bulkDelete={{
          entityLabel: tCommon('entities.works'),
          deleteAction,
          getRowLabel: (row) => row.title || row.slug || row.id,
          successMessage: tCommon('actions.delete'),
          onSuccess: async () => {
            await invalidateWorks();
          },
        }}
      />

      <ConfirmationDialog
        intent="delete"
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        onConfirm={() => selectedWork && deleteWork.mutate({ id: selectedWork.id })}
        title={tAdmin('works.deleteTitle')}
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteWork.isPending}
        message={
          <>
            <DsText>
              {tCommon('messages.deleteItemConfirm', {
                item: tCommon('entities.work').toLowerCase(),
              })}
            </DsText>
          </>
        }
      />
    </>
  );
}
