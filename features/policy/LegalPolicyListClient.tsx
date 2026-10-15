'use client';
import { Text as DsText } from '@/components/core/Typography';

import { ConfirmationDialog } from '@/features/confirmation';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconDots, IconEdit, IconFileText, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { StatusBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { TextButton } from '@/components/core/TextButton';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { DataTableSelectableSection } from '@/features/data-table/DataTableSelectableSection';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { EmptyState } from '@/components/core/EmptyState';

export interface LegalPolicyListItem {
  id: string;
  version: number;
  revision: string;
  title: string;
  status: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface LegalPolicyStatusStrategy {
  draft: string;
  scheduled: string;
  active: string;
  archived: string;
  isDraft: (status: string) => boolean;
  isScheduled: (status: string) => boolean;
  getColor: (status: string) => string;
}

interface ActionResult {
  error?: string;
}

interface CreateActionResult extends ActionResult {
  data?: { id: string };
}

interface LegalPolicyListClientProps {
  policy: 'privacy' | 'terms';
  initialVersions: LegalPolicyListItem[];
  status: LegalPolicyStatusStrategy;
  createVersion: () => Promise<CreateActionResult>;
  deleteVersion: (id: string, expectedRevision: string) => Promise<ActionResult>;
  searchPlaceholder: string;
}

interface PolicyStatusLabels {
  draft: string;
  scheduled: string;
  active: string;
  archived: string;
}

function translatePolicyStatus(value: string | null | undefined, labels: PolicyStatusLabels): string {
  switch (normalizeEnumToken(value)) {
    case 'draft':
      return labels.draft;
    case 'scheduled':
      return labels.scheduled;
    case 'active':
      return labels.active;
    case 'archived':
      return labels.archived;
    default:
      return value ?? '';
  }
}

export function LegalPolicyListClient({
  policy,
  initialVersions,
  status,
  createVersion,
  deleteVersion,
  searchPlaceholder,
}: LegalPolicyListClientProps) {
  const tModalActions = useTranslations('common.actions');
  const router = useRouter();
  const queryClient = useQueryClient();
  const requestDateTime = useDateTimeFormatter();
  const tCommon = useTranslations('common');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tLegalHistoryActions = useTranslations('legalHistoryCommon.actions');
  const [isNavigating, startNavigation] = useTransition();
  const [versions, setVersions] = useState(initialVersions);
  const [query, setQuery] = useState<PaginatedQuery>({ page: 1, pageSize: 20 });
  const [selectedVersion, setSelectedVersion] = useState<LegalPolicyListItem | null>(null);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const historyPath = `/${policy}/history`;
  const entityLabel = tCommonEntities(policy);
  const policyStatusLabels: PolicyStatusLabels = {
    draft: tCommon('statuses.draft'),
    scheduled: tCommon('statuses.scheduled'),
    active: tCommon('statuses.active'),
    archived: tCommon('statuses.archived'),
  };

  useEffect(() => {
    if (!deleteModalOpened) {
      setSelectedVersion(null);
    }
  }, [deleteModalOpened]);

  const createMutation = useMutation({
    mutationFn: createVersion,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemCreated', { item: tCommon('labels.version') }),
        tone: 'positive',
      });
      queryClient.invalidateQueries({ queryKey: [policy] });
      if (result.data) {
        startNavigation(() => router.push(`${historyPath}/${result.data?.id}?edit=true`));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, expectedRevision }: { id: string; expectedRevision: string }) =>
      deleteVersion(id, expectedRevision),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('labels.version') }),
        tone: 'positive',
      });
      setVersions((current) => current.filter((version) => version.id !== selectedVersion?.id));
      closeDeleteModal();
    },
  });

  const filterFields: FilterFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [status.draft, status.scheduled, status.active, status.archived].map((value) => ({
        value,
        label: translatePolicyStatus(value, policyStatusLabels),
      })),
    },
    { field: 'effective_from', label: tCommon('labels.effectiveFrom'), type: 'date' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];
  const sortFields: SortFieldConfig[] = [
    { field: 'version', label: tCommon('labels.version') },
    { field: 'title', label: tCommon('labels.title') },
    { field: 'status', label: tCommon('labels.status') },
    { field: 'effective_from', label: tCommon('labels.effectiveFrom') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];
  const columns: ColumnDef<LegalPolicyListItem>[] = [
    {
      key: 'version',
      header: tCommon('labels.version'),
      cell: (row) => (
        <DsText size="sm" weight="medium">
          v{row.version}
        </DsText>
      ),
    },
    {
      key: 'title',
      header: tCommon('labels.title'),
      cell: (row) => (
        <TextButton href={`${historyPath}/${row.id}?edit=true`} size="sm" weight="medium" appearance="accent">
          {row.title}
        </TextButton>
      ),
    },
    {
      key: 'status',
      header: tCommon('labels.status'),
      cell: (row) => (
        <StatusBadge
          tone={row.status === status.active ? 'positive' : status.isScheduled(row.status) ? 'accent' : 'neutral'}
          size="sm"
        >
          {translatePolicyStatus(row.status, policyStatusLabels)}
        </StatusBadge>
      ),
    },
    {
      key: 'effectiveFrom',
      header: tCommon('labels.effectiveFrom'),
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          {status.isDraft(row.status) || !row.effectiveFrom
            ? '-'
            : requestDateTime.dateTime(row.effectiveFrom, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
        </DsText>
      ),
    },
    {
      key: 'createdAt',
      header: tCommon('labels.created'),
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          {row.createdAt
            ? requestDateTime.dateTime(row.createdAt, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-'}
        </DsText>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenu.Target>
            <IconButton emphasis="low" aria-label={tCommon('labels.actions')}>
              <IconDots size={16} />
            </IconButton>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item
              icon={<IconEdit size={16} />}
              onClick={() => router.push(`${historyPath}/${row.id}?edit=true`)}
            >
              {tCommon('actions.edit')}
            </DropdownMenu.Item>
            <>
              <DropdownMenu.Divider />
              <DropdownMenu.Item
                icon={<IconTrash size={16} />}
                tone="danger"
                onClick={() => {
                  setSelectedVersion(row);
                  openDeleteModal();
                }}
              >
                {tCommon('actions.delete')}
              </DropdownMenu.Item>
            </>
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      ),
    },
  ];
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const result = {
    data: versions.slice((page - 1) * pageSize, page * pageSize),
    total: versions.length,
    page,
    pageSize,
    totalPages: Math.ceil(versions.length / pageSize),
  };
  const createPending = createMutation.isPending || isNavigating;

  return (
    <>
      <AdminPageHeader
        title={entityLabel}
        items={[
          {
            key: 'create-version',
            type: 'action',
            label: tLegalHistoryActions('newVersion'),
            icon: <IconPlus size={16} />,
            onClick: () => createMutation.mutate(),
            loading: createPending,
            disabled: createPending,
          },
        ]}
      />

      {result.total === 0 && !query.search && !query.filters?.length ? (
        <EmptyState
          icon={IconFileText}
          title={tCommon('messages.noVersionsFound')}
          action={
            <Button
              emphasis="medium"
              onClick={() => createMutation.mutate()}
              loading={createPending}
              disabled={createPending}
            >
              {tCommonActions('createFirstVersion')}
            </Button>
          }
        />
      ) : (
        <DataTableSelectableSection
          columns={columns}
          result={result}
          query={query}
          getRowKey={(row) => row.id}
          onQueryChange={setQuery}
          emptyMessage={tCommon('messages.noVersionsFound')}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          bulkDelete={{
            entityLabel,
            deleteAction: (id) => {
              const selected = versions.find((version) => version.id === id);
              return selected
                ? deleteVersion(selected.id, selected.revision)
                : Promise.resolve({ error: tCommon('messages.noVersionsFound') });
            },
            getRowLabel: (row) => row.title || row.id,
            successMessage: tCommon('messages.itemDeleted', { item: tCommon('labels.version') }),
            onSuccess: (successfulIds) => {
              setVersions((current) => current.filter((version) => !successfulIds.includes(version.id)));
            },
          }}
        />
      )}

      <ConfirmationDialog
        intent="delete"
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        onConfirm={() =>
          selectedVersion &&
          deleteMutation.mutate({ id: selectedVersion.id, expectedRevision: selectedVersion.revision })
        }
        title={tCommon('actions.deleteVersion')}
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tModalActions('close')}
        loading={deleteMutation.isPending}
        message={
          <>
            <DsText>{tCommon('messages.deleteItemConfirm', { item: entityLabel })}</DsText>
          </>
        }
      />
    </>
  );
}
