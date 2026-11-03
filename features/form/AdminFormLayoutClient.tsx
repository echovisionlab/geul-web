'use client';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { type ReactElement, useCallback, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconHammer, IconInbox, IconLanguage, IconSettings } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Tabs } from '@/components/core/Tabs';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { PageLoader } from '@/features/site/PageLoader';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { deleteFormAction, updateFormAction } from '@/lib/actions/form';
import { useFormEditorContext } from '@/lib/contexts/FormEditorContext';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { useFormTranslationContext } from '@/features/form/FormTranslationContext';

type FormStatus = 'draft' | 'published';

interface FormLayoutContentProps {
  children: ReactNode;
  formId: string;
  initialStatus?: FormStatus;
}

function useFormLayoutViewModel({ children, formId, initialStatus }: FormLayoutContentProps) {
  const t = useTranslations('formAdmin');
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonNotifications = useTranslations('common.notifications');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<FormStatus>(initialStatus ?? 'draft');
  const formsListPath = '/admin/forms';

  const { provider, isConnected, isSynced, fields, setField } = useFormEditorContext();
  const { activeEditLocale } = useFormTranslationContext();
  const shouldUseLocaleDocument =
    Boolean(activeEditLocale.activeLocale) && (activeEditLocale.isSourceLocale || activeEditLocale.hasLiveRow);
  const canEditTranslationSource = useEditorAccessLevel(provider) === 'edit';
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
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setStatus(nextStatus);
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        tone: 'danger',
      });
    },
  });

  const deleteForm = useMutation({
    mutationFn: () => deleteFormAction(formId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), tone: 'positive' });
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
    return <PageLoader placement="flow" />;
  }

  return {
    provider,
    formId,
    displayedTitle,
    titleChangeHandler,
    tCommon,
    canEditTranslationSource,
    titleDisabled,
    status,
    statusOptions,
    currentIsConnected,
    currentIsSynced,
    router: { push: router.push },
    formsListPath,
    t,
    updateStatus: { mutate: updateStatus.mutate, isPending: updateStatus.isPending },
    deleteForm: { mutate: deleteForm.mutate, isPending: deleteForm.isPending },
    activeEditLocale,
    currentTab,
    handleTabChange,
    navItems,
    children,
  };
}

function FormLayoutContent(props: FormLayoutContentProps) {
  const model = useFormLayoutViewModel(props);
  return 'provider' in model ? <FormLayoutView model={model} /> : model;
}

export type FormLayoutViewModel = Exclude<ReturnType<typeof useFormLayoutViewModel>, ReactElement>;

/** Complete production editor composition; controllers supply data and commands. */
export function FormLayoutView({ model }: { model: FormLayoutViewModel }) {
  const {
    provider,
    formId,
    displayedTitle,
    titleChangeHandler,
    tCommon,
    canEditTranslationSource,
    titleDisabled,
    status,
    statusOptions,
    currentIsConnected,
    currentIsSynced,
    router,
    formsListPath,
    t,
    updateStatus,
    deleteForm,
    activeEditLocale,
    currentTab,
    handleTabChange,
    navItems,
    children,
  } = model;
  return (
    <EditorRuntimeProvider provider={provider ?? null} entityType="form" entityId={formId}>
      <DsLayoutStack gap="md">
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
          onStatusChange={canEditTranslationSource ? (nextStatus) => updateStatus.mutate(nextStatus) : undefined}
          isStatusChanging={updateStatus.isPending}
          onDelete={canEditTranslationSource ? () => deleteForm.mutate() : undefined}
          deleteConfirmation={{
            title: tCommon('actions.delete'),
            message: (
              <DsLayoutStack gap="xs">
                <DsText>
                  {tCommon.rich('messages.confirmDeleteNamedRich', {
                    name: displayedTitle || tCommon('entities.form'),
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </DsText>
                <DsText size="sm" tone="warning">
                  {t('deleteModal.warning')}
                </DsText>
              </DsLayoutStack>
            ),
          }}
          isDeleting={deleteForm.isPending}
          groupStatusWithCollab
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
        />
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tabs.List aria-label={tCommon('entities.form')}>
            {navItems.map(({ value, label, Icon }) => (
              <Tabs.Tab key={value} value={value} leftSection={<Icon size={16} />}>
                {label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {navItems.map(({ value }) => (
            <Tabs.Panel key={value} value={value} paddingTop="md">
              {value === currentTab ? children : null}
            </Tabs.Panel>
          ))}
        </Tabs>
      </DsLayoutStack>
    </EditorRuntimeProvider>
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
