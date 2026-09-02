'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconEdit, IconEye, IconLayout, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { AdminPageHeader, type AdminPageHeaderItem } from '@/features/admin/ui/AdminPageHeader';
import { Alert } from '@/components/core/Alert';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { DataTableSelectableSection } from '@/features/data-table/DataTableSelectableSection';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { Textarea, TextInput } from '@/components/core/Input';
import { ConfirmModal, ContentModal, FormModal } from '@/components/core/Modal';
import { getEmailLayoutActionErrorMessage } from '@/features/admin/email-layout/action-error-message';
import { isEmailLayoutDeleteBlocked } from '@/features/email/deletion-policy';
import {
  createEmailLayoutAction,
  deleteEmailLayoutAction,
  type EmailLayoutActionErrorCode,
} from '@/lib/actions/email-layout';
import { buildEmailPreviewSrcDoc } from '@/lib/email/preview-document';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { listEmailLayouts, previewEmailLayout, type EmailLayout } from '@/lib/queries/email-layout';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';

export default function AdminEmailLayoutsPage() {
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.emailLayouts');
  const tDataTable = useTranslations('dataTable');
  const tSample = useTranslations('adminList.emailLayouts.detail.previewSample');
  const tUnsubscribe = useTranslations('unsubscribe.actions');
  const router = useRouter();
  const queryClient = useQueryClient();
  const emailLayoutErrorMessage = (result: { error?: string; errorCode?: EmailLayoutActionErrorCode }) =>
    getEmailLayoutActionErrorMessage({
      errorCode: result.errorCode,
      fallbackError: result.error,
      unauthorizedMessage: tCommon('errors.unauthorized'),
      duplicateKeyMessage: tCommon('errors.entityWithThisKeyAlreadyExists', {
        entity: tCommonEntities('emailLayout'),
      }),
      notFoundMessage: tCommon('errors.entityNotFound', {
        entity: tCommonEntities('emailLayout'),
      }),
      conflictMessage: tPage('deleteConflict'),
      genericMessage: tCommon('errors.generic'),
    });

  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: 20,
  });

  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'key', label: tCommon('labels.key'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'key', label: tCommon('labels.key') },
    { field: 'created_at', label: tCommon('labels.created') },
    { field: 'updated_at', label: tCommon('labels.updated') },
  ];

  const invalidateLayouts = () => {
    queryClient.invalidateQueries({ queryKey: ['emailLayouts'] });
  };

  const { data, isError, isLoading } = useQuery({
    queryKey: ['emailLayouts', query],
    queryFn: () =>
      listEmailLayouts({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
        sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
      }),
  });

  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [previewModalOpened, { open: openPreviewModal, close: closePreviewModal }] = useDisclosure(false);
  const [selectedLayout, setSelectedLayout] = useState<EmailLayout | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const previewSrcDoc = useMemo(() => buildEmailPreviewSrcDoc(previewHtml, null), [previewHtml]);
  const defaultHtmlContent = useMemo(
    () => `<!DOCTYPE html>
<html lang="{{email_lang}}" dir="{{email_direction}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="{{email_font_stylesheet_url}}">
  <title>{{subject}}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      font-family: {{email_font_family}} !important;
      direction: {{email_direction}};
      color: #171717;
    }
    body, div, header, main, footer, p, span, a, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, strong, em, small {
      font-family: {{email_font_family}} !important;
    }
    pre, code, kbd, samp {
      font-family: 'Noto Sans Mono', 'Noto Color Emoji', monospace !important;
    }
    a {
      color: #0f5f4b;
    }
    img {
      display: block;
      border: 0;
      max-width: 100%;
      height: auto;
    }
    .email-shell {
      max-width: 640px;
      margin: 0 auto;
      padding: 32px 16px 24px;
    }
    .email-header {
      margin-bottom: 0;
    }
    .email-divider {
      margin: 16px 0;
      border: 0;
      border-top: 1px solid #e5e7eb;
    }
    .email-body {
      margin: 0;
    }
    .email-footer {
      margin-top: 24px;
      font-size: 12px;
      line-height: 18px;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; color: #171717;">
  <div class="email-shell" style="max-width: 640px; margin: 0 auto; padding: 32px 16px 24px;">
    <header class="email-header" style="margin-bottom: 0;">
      <a href="{{site_origin}}" style="display: inline-block; text-decoration: none;">
        <img src="{{logo_email_url}}" alt="{{site_name}}" width="50" style="display: block; border: 0; max-width: 100%; height: auto;">
      </a>
    </header>
    <hr class="email-divider" style="margin: 16px 0; border: 0; border-top: 1px solid #e5e7eb;">
    <main class="email-body" style="margin: 0;">
      {{content}}
    </main>
    <footer class="email-footer" style="margin-top: 24px; font-size: 12px; line-height: 18px;">
      <a href="{{unsubscribe_link}}" style="color: #0f5f4b; text-decoration: underline;">${tUnsubscribe('unsubscribe')}</a>
    </footer>
  </div>
</body>
</html>`,
    [tUnsubscribe],
  );
  const previewSampleContent = useMemo(
    () => `<h1>${tSample('headline')}</h1><p>${tSample('bodyPrimary')}</p><p>${tSample('bodySecondary')}</p>`,
    [tSample],
  );

  const createForm = useForm({
    initialValues: {
      key: '',
      name: '',
      htmlContent: defaultHtmlContent,
    },
    validate: {
      key: (value) => (/^[a-z][a-z0-9_-]*$/.test(value) ? null : tPage('validation.key')),
      name: (value) => (value.trim().length > 0 ? null : tCommon('errors.nameRequired')),
      htmlContent: (value) => (value.includes('{{content}}') ? null : tPage('validation.htmlContent')),
    },
  });

  const createLayout = useMutation({
    mutationFn: (data: { key: string; name: string; htmlContent: string }) =>
      createEmailLayoutAction({
        ...data,
        sourceLocale: normalizeLocale(locale) ?? DEFAULT_LOCALE,
      }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: emailLayoutErrorMessage(result), color: 'red' });
        return;
      }
      notifications.show({ message: tPage('created'), color: 'green' });
      invalidateLayouts();
      closeCreateModal();
      createForm.reset();
    },
  });

  const deleteLayout = useMutation({
    mutationFn: (id: string) => deleteEmailLayoutAction(id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: emailLayoutErrorMessage(result), color: 'red' });
        closeDeleteModal();
        return;
      }
      notifications.show({ message: tPage('deleted'), color: 'green' });
      invalidateLayouts();
      closeDeleteModal();
    },
  });

  const handleEdit = (layout: EmailLayout) => {
    router.push(`/admin/email-layouts/${layout.id}`);
  };

  const handleDelete = (layout: EmailLayout) => {
    if (isEmailLayoutDeleteBlocked(layout)) {
      notifications.show({ message: tPage('deleteConflict'), color: 'red' });
      return;
    }
    setSelectedLayout(layout);
    openDeleteModal();
  };

  const handlePreview = async (layout: EmailLayout) => {
    setSelectedLayout(layout);
    const result = await previewEmailLayout(layout.id, previewSampleContent);
    if (result) {
      setPreviewHtml(result.html);
      openPreviewModal();
    } else {
      notifications.show({ message: tPage('loadPreviewFailed'), color: 'red' });
    }
  };

  useEffect(() => {
    if (!deleteModalOpened && !previewModalOpened) {
      setSelectedLayout(null);
    }
  }, [deleteModalOpened, previewModalOpened]);

  const columns: ColumnDef<EmailLayout>[] = [
    {
      key: 'name',
      header: tCommon('labels.name'),
      cell: (row) => (
        <Stack gap={2}>
          <TextButton href={`/admin/email-layouts/${row.id}`} size="sm" weight="medium" appearance="accent">
            {row.name}
          </TextButton>
          <Text size="xs" c="dimmed" ff="monospace">
            {row.key}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'created_at',
      header: tCommon('labels.created'),
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.createdAt} />
        </Text>
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
            label: tCommonLabels('preview'),
            icon: <IconEye size={16} />,
            onClick: () => handlePreview(row),
          },
          {
            label: tCommon('actions.edit'),
            icon: <IconEdit size={16} />,
            onClick: () => handleEdit(row),
          },
          {
            label: tPage('delete'),
            icon: <IconTrash size={16} />,
            onClick: () => handleDelete(row),
            color: 'red',
          },
        ];

        return <TableRowMenu aria-label={tDataTable('aria.rowActions', { label: row.name })} items={items} />;
      },
    },
  ];

  const headerItems: AdminPageHeaderItem[] = [
    {
      key: 'create-layout',
      type: 'action',
      label: tPage('newItem'),
      icon: <IconPlus size={16} />,
      onClick: openCreateModal,
    },
  ];

  return (
    <>
      <AdminPageHeader title={tCommonEntities('emailLayouts')} items={headerItems} />

      <Text size="sm" c="dimmed" mb="lg">
        {tPage('description')}
      </Text>

      {isError ? (
        <Alert tone="danger">{tCommon('errors.generic')}</Alert>
      ) : !isLoading && data?.total === 0 && !query.search && !query.filters?.length ? (
        <Stack align="center" py="xl">
          <IconLayout size={48} opacity={0.3} />
          <Text c="dimmed">{tPage('empty')}</Text>
        </Stack>
      ) : (
        <DataTableSelectableSection
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

      <FormModal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={tPage('createTitle')}
        closeLabel={tCommon('actions.close')}
        submitLabel={tCommon('actions.createItem', { item: tCommon('entities.emailLayout') })}
        cancelLabel={tCommon('actions.cancel')}
        loading={createLayout.isPending}
        size="large"
        onSubmit={() => {
          const validation = createForm.validate();
          if (!validation.hasErrors) {
            createLayout.mutate(createForm.values);
          }
        }}
      >
        <TextInput
          label={tCommon('labels.key')}
          placeholder={tPage('placeholders.key')}
          description={tPage('fields.keyDescription')}
          {...createForm.getInputProps('key')}
        />
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tPage('placeholders.name')}
          {...createForm.getInputProps('name')}
        />
        <Textarea
          label={tCommon('labels.htmlContent')}
          placeholder={tPage('placeholders.htmlContent')}
          description={tPage('fields.htmlContentDescription')}
          rows={15}
          styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
          {...createForm.getInputProps('htmlContent')}
        />
      </FormModal>

      <ConfirmModal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        onConfirm={() => {
          if (selectedLayout) {
            deleteLayout.mutate(selectedLayout.id);
          }
        }}
        title={tPage('deleteTitle')}
        message={tPage('deleteConfirm', {
          name: selectedLayout?.name ?? '',
        })}
        confirmLabel={tPage('delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        confirmTone="danger"
        loading={deleteLayout.isPending}
      />

      <ContentModal
        opened={previewModalOpened}
        onClose={closePreviewModal}
        title={tPage('previewTitle', { name: selectedLayout?.name ?? '' })}
        closeLabel={tCommon('actions.close')}
        size="large"
      >
        <div
          style={{
            border: '1px solid #eee',
            borderRadius: 4,
            overflow: 'hidden',
            backgroundColor: '#fff',
          }}
        >
          <iframe
            srcDoc={previewSrcDoc}
            style={{ width: '100%', height: 500, border: 'none' }}
            title={tCommonLabels('emailPreview')}
          />
        </div>
      </ContentModal>
    </>
  );
}
