'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation';

import { fieldBindings } from '@/components/core/bindings';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconEdit, IconMail, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { AdminPageHeader, type AdminPageHeaderItem } from '@/features/admin/ui/AdminPageHeader';
import { Alert } from '@/components/core/Alert';
import { getEmailTemplateDeleteErrorMessage } from '@/features/admin/email-template/delete-error-message';
import { getEmailTemplateDeleteBlocker } from '@/features/email/deletion-policy';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { DataTableSelectableSection } from '@/features/data-table/DataTableSelectableSection';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { Select, Textarea, TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import type { ActionErrorCode } from '@/lib/actions/action-result';
import {
  createEmailTemplateAction,
  deleteEmailTemplateAction,
  listEmailEventMappingsAction,
  listEmailTemplatesAdminAction,
  type EmailTemplateListItem,
  updateEmailTemplateEventMappingAction,
} from '@/lib/actions/email-template';
import { resolveSystemEmailEventKey } from '@/lib/i18n/email-template';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { SYSTEM_EMAIL_EVENT_KEYS } from '@/lib/types/email-template/system-events';
import { EmptyState } from '@/components/core/EmptyState';

export interface AdminEmailTemplatesPageBindings {
  listEmailEventMappingsAction: typeof listEmailEventMappingsAction;
  listEmailTemplatesAdminAction: typeof listEmailTemplatesAdminAction;
  updateEmailTemplateEventMappingAction: typeof updateEmailTemplateEventMappingAction;
  createEmailTemplateAction: typeof createEmailTemplateAction;
  deleteEmailTemplateAction: typeof deleteEmailTemplateAction;
}
const defaultBindings: AdminEmailTemplatesPageBindings = {
  listEmailEventMappingsAction,
  listEmailTemplatesAdminAction,
  updateEmailTemplateEventMappingAction,
  createEmailTemplateAction,
  deleteEmailTemplateAction,
};
export default function AdminEmailTemplatesPage({
  bindings = defaultBindings,
}: { bindings?: AdminEmailTemplatesPageBindings } = {}) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tDataTable = useTranslations('dataTable');
  const tPage = useTranslations('adminList.emailTemplates');
  const tSystemEvents = useTranslations('adminList.emailTemplates.systemEvents');
  const router = useRouter();
  const queryClient = useQueryClient();
  const emailTemplateDeleteErrorMessage = (result: { error?: string; errorCode?: ActionErrorCode }) =>
    getEmailTemplateDeleteErrorMessage({
      errorCode: result.errorCode,
      fallbackError: result.error,
      unauthorizedMessage: tCommon('errors.unauthorized'),
      notFoundMessage: tCommon('errors.entityNotFound', {
        entity: tCommonEntities('emailTemplate'),
      }),
      conflictMessage: tPage('deleteConflict'),
      genericMessage: tCommon('errors.generic'),
    });
  const [isNavigating, startNavigation] = useTransition();
  const eventSelectOptions = useMemo(
    () =>
      SYSTEM_EMAIL_EVENT_KEYS.map((eventKey) => ({
        value: eventKey,
        label: tSystemEvents(`${eventKey}.name`),
      })),
    [tSystemEvents],
  );

  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: 20,
  });

  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'key', label: tCommon('labels.key'), type: 'string' },
    { field: 'is_system', label: tCommon('labels.type'), type: 'boolean' },
    { field: 'is_active', label: tCommon('labels.status'), type: 'boolean' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'key', label: tCommon('labels.key') },
    { field: 'created_at', label: tCommon('labels.created') },
    { field: 'updated_at', label: tCommon('labels.updated') },
  ];

  const invalidateEmailTemplates = () => {
    queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
  };

  const {
    data: eventMappings,
    isError: isEventMappingsError,
    isLoading: isLoadingEventMappings,
  } = useQuery({
    queryKey: ['emailTemplates', 'eventMappings'],
    queryFn: () => bindings.listEmailEventMappingsAction(),
  });

  // Paginated list for DataTable
  const { data, isError, isLoading } = useQuery({
    queryKey: ['emailTemplates', 'admin', query],
    queryFn: () =>
      bindings.listEmailTemplatesAdminAction({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
      }),
  });

  const updateEventMapping = useMutation({
    mutationFn: ({ eventKey, templateId }: { eventKey: string; templateId: string | null }) =>
      bindings.updateEmailTemplateEventMappingAction(eventKey, templateId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('eventMappingUpdated'), tone: 'positive' });
      invalidateEmailTemplates();
    },
  });

  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateListItem | null>(null);

  const createForm = useForm({
    initialValues: {
      key: '',
      name: '',
      subject: '',
      description: '',
    },
    validate: {
      key: (value) => (/^[a-z][a-z0-9_]*$/.test(value) ? null : tPage('validation.key')),
      name: (value) => (value.length > 0 ? null : tCommon('errors.nameRequired')),
      subject: (value) => (value.length > 0 ? null : tPage('validation.subject')),
    },
  });

  const createTemplate = useMutation({
    mutationFn: (data: { key: string; name: string; subject: string; description?: string }) =>
      bindings.createEmailTemplateAction(data),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('created'), tone: 'positive' });
      invalidateEmailTemplates();
      if (result.data) {
        const href = `/admin/email-templates/${result.data.id}`;
        startNavigation(() => {
          router.push(href);
        });
        return;
      }
      closeCreateModal();
      createForm.reset();
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => bindings.deleteEmailTemplateAction(id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({
          message: emailTemplateDeleteErrorMessage(result),
          tone: 'danger',
        });
        closeDeleteModal();
        return;
      }
      notifications.show({ message: tPage('deleted'), tone: 'positive' });
      invalidateEmailTemplates();
      queryClient.invalidateQueries({ queryKey: ['emailTemplates', 'eventMappings'] });
      closeDeleteModal();
    },
  });

  const handleDelete = (template: EmailTemplateListItem) => {
    const blocker = getEmailTemplateDeleteBlocker(template);
    if (blocker === 'in-use') {
      notifications.show({ message: tPage('deleteConflict'), tone: 'danger' });
      return;
    }
    setSelectedTemplate(template);
    openDeleteModal();
  };

  const assignedEventKeys = new Set((eventMappings ?? []).map((mapping) => mapping.event));
  const unassignedEventKeys = SYSTEM_EMAIL_EVENT_KEYS.filter((key) => !assignedEventKeys.has(key));
  const unassignedEventNames = unassignedEventKeys.map((eventKey) => tSystemEvents(`${eventKey}.name`));
  const unassignedPreview = unassignedEventNames.slice(0, 4).join(', ');

  const columns: ColumnDef<EmailTemplateListItem>[] = [
    {
      key: 'name',
      header: tCommon('labels.name'),
      cell: (row) => {
        const systemEventKey = resolveSystemEmailEventKey(row.eventKey ?? row.key);
        const systemMeta =
          row.isSystem && systemEventKey
            ? {
                name: tSystemEvents(`${systemEventKey}.name`),
                description: tSystemEvents(`${systemEventKey}.description`),
              }
            : null;

        return (
          <DsLayoutStack gap="xxs">
            <TextButton href={`/admin/email-templates/${row.id}`} size="sm" weight="medium" appearance="accent">
              {systemMeta?.name ?? row.name}
            </TextButton>
            {(systemMeta?.description ?? row.description) && (
              <DsText size="xs" tone="secondary" lines={1}>
                {systemMeta?.description ?? row.description}
              </DsText>
            )}
          </DsLayoutStack>
        );
      },
    },
    {
      key: 'subject',
      header: tCommon('labels.subject'),
      cell: (row) => (
        <DsText size="sm" tone="secondary" lines={1}>
          {row.subject}
        </DsText>
      ),
    },
    {
      key: 'event',
      header: tCommon('labels.event'),
      width: 280,
      cell: (row) => (
        <Select
          aria-label={`${tCommon('labels.event')} ${row.name}`}
          size="xs"
          value={row.eventKey ?? null}
          placeholder={isLoadingEventMappings ? tCommon('states.loading') : tPage('notAssigned')}
          aria-busy={isLoadingEventMappings || updateEventMapping.isPending}
          clearable
          searchable
          nothingFoundMessage={tPage('noEvents')}
          data={eventSelectOptions}
          onChange={(nextEventKey) => {
            const currentEventKey = row.eventKey ?? null;
            if (nextEventKey === currentEventKey) {
              return;
            }
            if (nextEventKey && !row.isActive) {
              notifications.show({
                message: tPage('inactiveAssignmentError'),
                tone: 'danger',
              });
              return;
            }
            if (!nextEventKey && currentEventKey) {
              updateEventMapping.mutate({
                eventKey: currentEventKey,
                templateId: null,
              });
              return;
            }
            if (nextEventKey) {
              updateEventMapping.mutate({
                eventKey: nextEventKey,
                templateId: row.id,
              });
            }
          }}
          disabled={isLoadingEventMappings || isEventMappingsError || updateEventMapping.isPending}
          error={isEventMappingsError ? tCommon('states.notAvailable') : undefined}
          description={
            updateEventMapping.isPending && updateEventMapping.variables?.templateId === row.id
              ? tCommon('states.syncing')
              : undefined
          }
        />
      ),
    },
    {
      key: 'status',
      header: tCommon('labels.status'),
      cell: (row) => (
        <DsLayoutInline gap="xs">
          {row.isSystem && <LabelBadge tone="accent">{tPage('badges.system')}</LabelBadge>}
          <StatusBadge tone={row.isActive ? 'positive' : 'neutral'}>
            {row.isActive ? tCommon('statuses.active') : tCommon('statuses.inactive')}
          </StatusBadge>
        </DsLayoutInline>
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
            onClick: () => router.push(`/admin/email-templates/${row.id}`),
          },
          {
            label: tPage('delete'),
            icon: <IconTrash size={16} />,
            onClick: () => handleDelete(row),
            tone: 'danger',
          },
        ];

        return <TableRowMenu aria-label={tDataTable('aria.rowActions', { label: row.name })} items={items} />;
      },
    },
  ];

  const headerItems: AdminPageHeaderItem[] = [
    {
      key: 'create-template',
      type: 'action',
      label: tPage('newItem'),
      icon: <IconPlus size={16} />,
      onClick: openCreateModal,
    },
  ];

  return (
    <>
      <AdminPageHeader title={tCommonEntities('emailTemplates')} items={headerItems} />

      <DsLayoutStack gap="xs">
        <DsLayoutInline justify="between" align="start">
          <DsLayoutStack gap="xxs">
            <DsText size="sm" weight="strong">
              {tPage('sectionTitle')}
            </DsText>
            <SupportingText tone="secondary">{tPage('sectionDescription')}</SupportingText>
          </DsLayoutStack>
          <DsLayoutInline gap="xs">
            {!isEventMappingsError && (
              <LabelBadge tone="accent">
                {isLoadingEventMappings
                  ? tPage('loadingAssignments')
                  : tPage('assignedSummary', {
                      count: assignedEventKeys.size,
                      total: SYSTEM_EMAIL_EVENT_KEYS.length,
                    })}
              </LabelBadge>
            )}
            {!isEventMappingsError && !isLoadingEventMappings && unassignedEventKeys.length > 0 && (
              <LabelBadge tone="warning">{tPage('unassignedCount', { count: unassignedEventKeys.length })}</LabelBadge>
            )}
          </DsLayoutInline>
        </DsLayoutInline>
        {isEventMappingsError && (
          <Alert role="alert" tone="danger">
            {tCommon('errors.generic')}
          </Alert>
        )}
        {!isEventMappingsError && !isLoadingEventMappings && unassignedEventKeys.length > 0 && (
          <DsText size="xs" tone="secondary">
            {tPage('missing', { items: unassignedPreview })}
            {unassignedEventNames.length > 4 && tPage('andMore', { count: unassignedEventNames.length - 4 })}
          </DsText>
        )}
        {isError ? (
          <Alert role="alert" tone="danger">
            {tCommon('errors.generic')}
          </Alert>
        ) : !isLoading && data?.total === 0 && !query.search && !query.filters?.length ? (
          <EmptyState icon={IconMail} title={tPage('empty')} live />
        ) : (
          <DataTableSelectableSection
            accessibleLabel={tCommonEntities('emailTemplates')}
            columns={columns}
            result={data}
            loading={isLoading}
            query={query}
            getRowKey={(row) => row.id}
            onQueryChange={setQuery}
            emptyMessage={tPage('emptyFiltered')}
            searchPlaceholder={tPage('searchPlaceholder')}
            filterFields={filterFields}
            sortFields={sortFields}
          />
        )}
      </DsLayoutStack>

      <FormModal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={tPage('createTitle')}
        closeLabel={tCommon('actions.close')}
        submitLabel={tCommon('actions.createItem', { item: tCommon('entities.emailTemplate') })}
        cancelLabel={tCommon('actions.cancel')}
        loading={createTemplate.isPending || isNavigating}
        onSubmit={() => {
          const validation = createForm.validate();
          if (!validation.hasErrors) {
            createTemplate.mutate(createForm.values);
          }
        }}
      >
        <TextInput
          label={tCommon('labels.key')}
          placeholder={tPage('placeholders.key')}
          description={tPage('fields.keyDescription')}
          {...fieldBindings(createForm.getInputProps('key'))}
        />
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tPage('placeholders.name')}
          {...fieldBindings(createForm.getInputProps('name'))}
        />
        <TextInput
          label={tCommon('labels.subject')}
          placeholder={tPage('placeholders.subject')}
          {...fieldBindings(createForm.getInputProps('subject'))}
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tPage('placeholders.description')}
          {...fieldBindings(createForm.getInputProps('description'))}
        />
      </FormModal>

      <ConfirmationDialog
        intent="delete"
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        onConfirm={() => {
          if (selectedTemplate) {
            deleteTemplate.mutate(selectedTemplate.id);
          }
        }}
        title={tPage('deleteTitle')}
        message={tPage('deleteConfirm', {
          name: selectedTemplate?.name ?? '',
        })}
        confirmLabel={tPage('delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteTemplate.isPending}
      />
    </>
  );
}
