'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconHammer, IconInbox, IconLanguage, IconSettings } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Tabs } from '@/components/core/Tabs';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { PageLoader } from '@/features/site/PageLoader';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { deleteFormAction, updateFormAction } from '@/lib/actions/form';
import { useFormEditorContext } from '@/lib/contexts/FormEditorContext';
import { useFormTranslationContext } from '@/features/form/FormTranslationContext';

type FormStatus = 'draft' | 'published';

interface FormLayoutContentProps {
  children: ReactNode;
  formId: string;
  initialStatus?: FormStatus;
}

function FormLayoutContent({ children, formId, initialStatus }: FormLayoutContentProps) {
  const t = useTranslations('formAdmin');
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonNotifications = useTranslations('common.notifications');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<FormStatus>(initialStatus ?? 'draft');
  const formsListPath = '/admin/forms';

  const { isConnected, isSynced, fields, setField } = useFormEditorContext();
  const { activeEditLocale } = useFormTranslationContext();
  const shouldUseLocaleDocument =
    Boolean(activeEditLocale.activeLocale) && (activeEditLocale.isSourceLocale || activeEditLocale.hasLiveRow);
  const canEditTranslationSource = true;
  const canEditCurrentLocale =
    canEditTranslationSource && activeEditLocale.canEditActiveLocale && shouldUseLocaleDocument && isSynced;

  const navItems = [
    { value: 'builder', label: t('navigation.tabs.builder'), Icon: IconHammer },
    { value: 'submissions', label: tCommon('labels.submissions'), Icon: IconInbox },
    { value: 'settings', label: tCommon('labels.settings'), Icon: IconSettings },
    { value: 'translations', label: tCommonEntities('translations'), Icon: IconLanguage },
  ];

  const statusOptions: StatusOption<FormStatus>[] = [
    {
      value: 'draft',
      label: tCommon('statuses.draft'),
      actionLabel: tCommon('actions.unpublish'),
      tone: 'neutral',
    },
    {
      value: 'published',
      label: tCommon('statuses.published'),
      actionLabel: tCommon('actions.publish'),
      tone: 'positive',
    },
  ];

  const basePath = `/forms/${encodeURIComponent(formId)}`;
  const requestedTab = searchParams.get('tab');
  const currentTab = navItems.some((item) => item.value === requestedTab) ? requestedTab! : 'builder';

  const handleTabChange = (value: string | null) => {
    const item = navItems.find((candidate) => candidate.value === value);
    if (!item) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('edit', 'true');
    nextParams.set('tab', item.value);
    router.push(`${basePath}?${nextParams.toString()}`);
  };

  const updateStatus = useMutation({
    mutationFn: (nextStatus: FormStatus) => updateFormAction(formId, { status: nextStatus }),
    onSuccess: (result, nextStatus) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setStatus(nextStatus);
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        color: 'red',
      });
    },
  });

  const deleteForm = useMutation({
    mutationFn: () => deleteFormAction(formId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), color: 'red' });
      router.push(formsListPath);
    },
  });

  const handleTitleChange = useCallback(
    (value: string) => {
      if (canEditCurrentLocale) {
        setField('title', value);
      }
    },
    [canEditCurrentLocale, setField],
  );

  const currentIsConnected = isConnected;
  const currentIsSynced = isSynced;
  const displayedTitle = fields.title;
  const titleChangeHandler = canEditCurrentLocale ? handleTitleChange : undefined;
  const titleDisabled = !canEditCurrentLocale;

  if (activeEditLocale.isLoading || (shouldUseLocaleDocument && !isConnected)) {
    return <PageLoader />;
  }

  return (
    <Stack gap="md">
      <EditorHeader
        title={displayedTitle}
        onTitleChange={titleChangeHandler}
        titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.form') })}
        titleDisabled={titleDisabled}
        status={status}
        statusOptions={statusOptions}
        isConnected={currentIsConnected}
        isSynced={currentIsSynced}
        onBack={() => router.push(formsListPath)}
        backTooltip={t('navigation.backToForms')}
        onStatusChange={(nextStatus) => updateStatus.mutate(nextStatus)}
        isStatusChanging={updateStatus.isPending}
        onDelete={() => deleteForm.mutate()}
        deleteConfirmation={{
          title: tCommon('actions.delete'),
          message: (
            <Stack gap="xs">
              <Text>
                {tCommon.rich('messages.confirmDeleteNamedRich', {
                  name: displayedTitle || tCommon('entities.form'),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </Text>
              <Text size="sm" c="orange">
                {t('deleteModal.warning')}
              </Text>
            </Stack>
          ),
        }}
        isDeleting={deleteForm.isPending}
        groupStatusWithCollab
        controls={<EditorActiveLocaleControl state={activeEditLocale} />}
      />
      <Tabs value={currentTab} onChange={handleTabChange}>
        <Tabs.List>
          {navItems.map(({ value, label, Icon }) => (
            <Tabs.Tab key={value} value={value} leftSection={<Icon size={16} />}>
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      {children}
    </Stack>
  );
}

interface AdminFormLayoutClientProps {
  children: ReactNode;
  formId: string;
  initialStatus?: FormStatus;
}

export function AdminFormLayoutClient({ children, formId, initialStatus = 'draft' }: AdminFormLayoutClientProps) {
  return (
    <FormLayoutContent formId={formId} initialStatus={initialStatus ?? 'draft'}>
      {children}
    </FormLayoutContent>
  );
}
