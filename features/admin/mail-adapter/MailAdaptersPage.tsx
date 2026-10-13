'use client';
import { SupportingText, Text as DsText, Heading as DsHeading } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation';

import { fieldBindings } from '@/components/core/bindings';
import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import {
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
  LayoutInset,
} from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useState } from 'react';
import { MailAdapterType } from '@echovisionlab/geul-proto/secure/mail_adapter_pb.ts';
import { IconMail, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { PasswordInput, Select, TextInput, NumberInput, Switch } from '@/components/core/Input';

import { SectionHeader } from '@/components/core/Section';
import { TextButton } from '@/components/core/TextButton';
import {
  createMailAdapterAction,
  deleteMailAdapterAction,
  listMailAdaptersAction,
  testMailAdapterAction,
  testMailAdapterConfigAction,
  toggleMailAdapterAction,
  updateMailAdapterAction,
  type PlainMailAdapter,
} from '@/lib/actions/mail-adapter';
import {
  buildMailAdapterConfigPayload,
  getMailAdapterConfigFingerprint,
  type MailAdapterFormType,
  type MailAdapterFormValues,
} from '@/lib/mail-adapter/form';
import { EmptyState } from '@/components/core/EmptyState';

function getMailAdapterType(type: MailAdapterFormType): MailAdapterType {
  switch (type) {
    case 'logging':
      return MailAdapterType.LOGGING;
    case 'ses':
      return MailAdapterType.SES;
    case 'smtp':
      return MailAdapterType.SMTP;
  }
}

function getAdapterTypeOption(type: MailAdapterType): MailAdapterFormType {
  switch (type) {
    case MailAdapterType.LOGGING:
      return 'logging';
    case MailAdapterType.SES:
      return 'ses';
    case MailAdapterType.SMTP:
      return 'smtp';
    default:
      return 'logging';
  }
}

const DEFAULT_FORM_VALUES: MailAdapterFormValues = {
  name: '',
  type: 'logging',
  isActive: true,
  priority: 0,
  sesRegion: 'us-east-1',
  sesAccessKeyId: '',
  sesSecretAccessKey: '',
  sesFromEmail: '',
  sesFromName: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: '',
};

export interface MailAdaptersPageBindings {
  createMailAdapterAction: typeof createMailAdapterAction;
  deleteMailAdapterAction: typeof deleteMailAdapterAction;
  listMailAdaptersAction: typeof listMailAdaptersAction;
  testMailAdapterAction: typeof testMailAdapterAction;
  testMailAdapterConfigAction: typeof testMailAdapterConfigAction;
  toggleMailAdapterAction: typeof toggleMailAdapterAction;
  updateMailAdapterAction: typeof updateMailAdapterAction;
}
const defaultBindings: MailAdaptersPageBindings = {
  createMailAdapterAction,
  deleteMailAdapterAction,
  listMailAdaptersAction,
  testMailAdapterAction,
  testMailAdapterConfigAction,
  toggleMailAdapterAction,
  updateMailAdapterAction,
};
export default function MailAdaptersPage({ bindings = defaultBindings }: { bindings?: MailAdaptersPageBindings } = {}) {
  const tCommon = useTranslations('common');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tPage = useTranslations('adminSettings.mail');
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editAdapter, setEditAdapter] = useState<PlainMailAdapter | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [createTestEmail, setCreateTestEmail] = useState('');
  const [verifiedCreateFingerprint, setVerifiedCreateFingerprint] = useState<string | null>(null);
  const [deleteAdapter, setDeleteAdapter] = useState<PlainMailAdapter | null>(null);

  const adaptersQuery = useQuery({
    queryKey: ['mailAdapters'],
    queryFn: async () => {
      const result = await bindings.listMailAdaptersAction();
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
  });
  const { data, isLoading } = adaptersQuery;

  const adapters = data?.adapters ?? [];

  const adapterTypeOptions: { value: MailAdapterFormType; label: string }[] = [
    { value: 'logging', label: tPage('adapterTypes.logging') },
    { value: 'ses', label: tPage('adapterTypes.ses') },
    { value: 'smtp', label: tPage('adapterTypes.smtp') },
  ];

  const getAdapterTypeBadge = (type: MailAdapterType) => {
    switch (type) {
      case MailAdapterType.LOGGING:
        return <LabelBadge tone="neutral">{tPage('badges.logging')}</LabelBadge>;
      case MailAdapterType.SES:
        return <LabelBadge tone="neutral">{tPage('badges.ses')}</LabelBadge>;
      case MailAdapterType.SMTP:
        return <LabelBadge tone="neutral">{tPage('badges.smtp')}</LabelBadge>;
      default:
        return <LabelBadge tone="neutral">{tCommon('states.unknown')}</LabelBadge>;
    }
  };

  const form = useForm<MailAdapterFormValues>({
    initialValues: DEFAULT_FORM_VALUES,
    validate: {
      name: (value) => (!value.trim() ? tCommon('errors.nameRequired') : null),
      sesFromEmail: (value, values) => {
        if (values.type !== 'ses') {
          return null;
        }
        if (!value) {
          return tPage('validation.fromEmailRequired');
        }
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : tPage('validation.invalidEmail');
      },
      smtpHost: (value, values) => {
        if (values.type !== 'smtp') {
          return null;
        }
        return !value.trim() ? tPage('validation.hostRequired') : null;
      },
      smtpFromEmail: (value, values) => {
        if (values.type !== 'smtp') {
          return null;
        }
        if (!value) {
          return tPage('validation.fromEmailRequired');
        }
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : tPage('validation.invalidEmail');
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: bindings.createMailAdapterAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('notifications.created'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['mailAdapters'] });
      closeCreate();
      resetCreateTestState();
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: bindings.updateMailAdapterAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('notifications.updated'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['mailAdapters'] });
      setEditAdapter(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: bindings.deleteMailAdapterAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('notifications.deleted'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['mailAdapters'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => bindings.toggleMailAdapterAction(id, isActive),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['mailAdapters'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => bindings.testMailAdapterAction(id, email),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({
          message: tPage('notifications.testFailed', { error: result.error }),
          tone: 'danger',
        });
      } else if (result.success) {
        notifications.show({ message: tPage('notifications.testSent'), tone: 'positive' });
      }
      setTestingId(null);
    },
  });

  const testConfigMutation = useMutation({
    mutationFn: (input: { values: MailAdapterFormValues; email: string }) =>
      bindings.testMailAdapterConfigAction({
        type: getMailAdapterType(input.values.type),
        testEmail: input.email,
        ...buildMailAdapterConfigPayload(input.values),
      }),
    onSuccess: (result, input) => {
      if (result.error || !result.success) {
        notifications.show({
          message: tPage('notifications.configTestFailed', {
            error: result.error ?? tCommon('states.unknown'),
          }),
          tone: 'danger',
        });
        setVerifiedCreateFingerprint(null);
        return;
      }
      notifications.show({ message: tPage('notifications.configTestPassed'), tone: 'positive' });
      setVerifiedCreateFingerprint(getMailAdapterConfigFingerprint(input.values));
    },
  });

  const currentCreateFingerprint = getMailAdapterConfigFingerprint(form.values);
  const requiresCreateTest = form.values.type !== 'logging';
  const isCreateReady = !requiresCreateTest || verifiedCreateFingerprint === currentCreateFingerprint;

  const resetCreateTestState = () => {
    setCreateTestEmail('');
    setVerifiedCreateFingerprint(null);
  };

  const handleOpenCreate = () => {
    form.reset();
    resetCreateTestState();
    openCreate();
  };

  const handleTestCreateConfig = () => {
    if (!createTestEmail) {
      notifications.show({ message: tPage('notifications.enterTestEmail'), tone: 'danger' });
      return;
    }

    testConfigMutation.mutate({
      values: { ...form.values },
      email: createTestEmail,
    });
  };

  const handleCreate = (values: MailAdapterFormValues) => {
    if (values.type !== 'logging' && verifiedCreateFingerprint !== getMailAdapterConfigFingerprint(values)) {
      notifications.show({
        message: tPage('notifications.runConfigTestBeforeCreate'),
        tone: 'danger',
      });
      return;
    }

    createMutation.mutate({
      name: values.name,
      type: getMailAdapterType(values.type),
      isActive: values.isActive,
      priority: values.priority,
      ...buildMailAdapterConfigPayload(values),
    });
  };

  const handleUpdate = (values: MailAdapterFormValues) => {
    if (!editAdapter) {
      return;
    }

    const nextType = getMailAdapterType(values.type);
    const typeChanged = nextType !== editAdapter.type;

    let shouldUpdateConfig = typeChanged;
    if (!typeChanged) {
      if (values.type === 'ses' && editAdapter.config.case === 'sesConfig') {
        const current = editAdapter.config.value;
        shouldUpdateConfig =
          values.sesRegion !== current.region ||
          values.sesAccessKeyId !== current.accessKeyId ||
          values.sesFromEmail !== current.fromEmail ||
          values.sesFromName !== (current.fromName ?? '') ||
          values.sesSecretAccessKey.trim() !== '';
      } else if (values.type === 'smtp' && editAdapter.config.case === 'smtpConfig') {
        const current = editAdapter.config.value;
        shouldUpdateConfig =
          values.smtpHost !== current.host ||
          values.smtpPort !== current.port ||
          values.smtpSecure !== current.secure ||
          values.smtpUser !== current.user ||
          values.smtpFromEmail !== current.fromEmail ||
          values.smtpFromName !== (current.fromName ?? '') ||
          values.smtpPassword.trim() !== '';
      }
    }

    if (shouldUpdateConfig && values.type === 'ses' && !values.sesSecretAccessKey.trim()) {
      notifications.show({
        message: tPage('notifications.sesSecretRequired'),
        tone: 'danger',
      });
      return;
    }

    if (shouldUpdateConfig && values.type === 'smtp' && !values.smtpPassword.trim()) {
      notifications.show({
        message: tPage('notifications.smtpPasswordRequired'),
        tone: 'danger',
      });
      return;
    }

    updateMutation.mutate({
      id: editAdapter.id,
      name: values.name,
      type: nextType,
      isActive: values.isActive,
      priority: values.priority,
      ...(shouldUpdateConfig ? buildMailAdapterConfigPayload(values) : {}),
    });
  };

  const openEditModal = (adapter: PlainMailAdapter) => {
    setEditAdapter(adapter);
    form.setValues({
      name: adapter.name,
      type: getAdapterTypeOption(adapter.type),
      isActive: adapter.isActive,
      priority: adapter.priority,
      sesRegion: adapter.config.case === 'sesConfig' ? adapter.config.value.region : 'us-east-1',
      sesAccessKeyId: adapter.config.case === 'sesConfig' ? adapter.config.value.accessKeyId : '',
      sesSecretAccessKey: '', // Never returned from server
      sesFromEmail: adapter.config.case === 'sesConfig' ? adapter.config.value.fromEmail : '',
      sesFromName: adapter.config.case === 'sesConfig' ? (adapter.config.value.fromName ?? '') : '',
      smtpHost: adapter.config.case === 'smtpConfig' ? adapter.config.value.host : '',
      smtpPort: adapter.config.case === 'smtpConfig' ? adapter.config.value.port : 587,
      smtpSecure: adapter.config.case === 'smtpConfig' ? adapter.config.value.secure : false,
      smtpUser: adapter.config.case === 'smtpConfig' ? adapter.config.value.user : '',
      smtpPassword: '', // Never returned from server
      smtpFromEmail: adapter.config.case === 'smtpConfig' ? adapter.config.value.fromEmail : '',
      smtpFromName: adapter.config.case === 'smtpConfig' ? (adapter.config.value.fromName ?? '') : '',
    });
  };

  const renderConfigFields = (type: MailAdapterFormType) => {
    if (type === 'ses') {
      return (
        <>
          <SectionHeader title={tPage('config.ses.sectionTitle')} />
          <TextInput
            label={tCommon('labels.region')}
            placeholder={tPage('config.ses.region.placeholder')}
            {...fieldBindings(form.getInputProps('sesRegion'))}
          />
          <TextInput
            label={tPage('config.ses.accessKeyId.label')}
            placeholder={tPage('config.ses.accessKeyId.placeholder')}
            {...fieldBindings(form.getInputProps('sesAccessKeyId'))}
          />
          <PasswordInput
            label={tPage('config.ses.secretAccessKey.label')}
            placeholder={tPage('config.ses.secretAccessKey.placeholder')}
            description={editAdapter ? tPage('config.ses.secretAccessKey.descriptionEdit') : undefined}
            {...fieldBindings(form.getInputProps('sesSecretAccessKey'))}
          />
          <TextInput
            label={tCommon('labels.fromEmail')}
            placeholder={tCommon('placeholders.noReplyEmail')}
            {...fieldBindings(form.getInputProps('sesFromEmail'))}
          />
          <TextInput
            label={tCommon('labels.fromNameOptional')}
            placeholder={tPage('config.ses.fromName.placeholder')}
            {...fieldBindings(form.getInputProps('sesFromName'))}
          />
        </>
      );
    }

    if (type === 'smtp') {
      return (
        <>
          <SectionHeader title={tPage('config.smtp.sectionTitle')} />
          <TextInput
            label={tPage('config.smtp.host.label')}
            placeholder={tPage('config.smtp.host.placeholder')}
            {...fieldBindings(form.getInputProps('smtpHost'))}
          />
          <DsLayoutInline grow>
            <NumberInput
              label={tPage('config.smtp.port.label')}
              placeholder={tPage('config.smtp.port.placeholder')}
              min={1}
              max={65535}
              {...fieldBindings(form.getInputProps('smtpPort'))}
            />
            <LayoutInset space="none" blockStart="lg">
              <Switch
                label={tPage('config.smtp.secure.label')}
                description={tPage('config.smtp.secure.description')}
                {...fieldBindings(form.getInputProps('smtpSecure', { type: 'checkbox' }))}
              />
            </LayoutInset>
          </DsLayoutInline>
          <TextInput
            label={tPage('config.smtp.user.label')}
            placeholder={tPage('config.smtp.user.placeholder')}
            {...fieldBindings(form.getInputProps('smtpUser'))}
          />
          <PasswordInput
            label={tCommon('labels.password')}
            placeholder={tCommonPlaceholders('password')}
            description={editAdapter ? tPage('config.smtp.password.descriptionEdit') : undefined}
            {...fieldBindings(form.getInputProps('smtpPassword'))}
          />
          <TextInput
            label={tCommon('labels.fromEmail')}
            placeholder={tCommon('placeholders.noReplyEmail')}
            {...fieldBindings(form.getInputProps('smtpFromEmail'))}
          />
          <TextInput
            label={tCommon('labels.fromNameOptional')}
            placeholder={tPage('config.smtp.fromName.placeholder')}
            {...fieldBindings(form.getInputProps('smtpFromName'))}
          />
        </>
      );
    }

    return <SupportingText tone="secondary">{tPage('config.logging.description')}</SupportingText>;
  };

  const renderFormModal = (isEdit: boolean) => (
    <ContentModal
      closeLabel={tCommon('actions.close')}
      loading={createMutation.isPending || updateMutation.isPending}
      opened={isEdit ? !!editAdapter : createOpened}
      onClose={() => {
        if (isEdit) {
          setEditAdapter(null);
        } else {
          closeCreate();
          resetCreateTestState();
        }
        form.reset();
      }}
      title={isEdit ? tPage('modal.editTitle') : tPage('modal.createTitle')}
      size="standard"
    >
      <form onSubmit={form.onSubmit(isEdit ? handleUpdate : handleCreate)}>
        <DsLayoutStack gap="md">
          <TextInput
            label={tCommon('labels.name')}
            placeholder={tPage('fields.namePlaceholder')}
            {...fieldBindings(form.getInputProps('name'))}
          />
          <Select
            label={tCommon('labels.type')}
            data={adapterTypeOptions}
            value={form.values.type}
            onChange={(value) => {
              if (!value) {
                return;
              }

              const nextType = value as MailAdapterFormType;
              if (nextType === form.values.type) {
                return;
              }

              form.setValues((prev) => ({
                ...prev,
                type: nextType,
                sesRegion: DEFAULT_FORM_VALUES.sesRegion,
                sesAccessKeyId: '',
                sesSecretAccessKey: '',
                sesFromEmail: '',
                sesFromName: '',
                smtpHost: '',
                smtpPort: DEFAULT_FORM_VALUES.smtpPort,
                smtpSecure: DEFAULT_FORM_VALUES.smtpSecure,
                smtpUser: '',
                smtpPassword: '',
                smtpFromEmail: '',
                smtpFromName: '',
              }));
              form.clearErrors();

              if (!isEdit) {
                resetCreateTestState();
              }
            }}
            disabled={createMutation.isPending || updateMutation.isPending}
            error={form.errors.type}
          />
          <DsLayoutInline grow>
            <NumberInput
              label={tCommon('labels.priority')}
              description={tPage('fields.priority.description')}
              {...fieldBindings(form.getInputProps('priority'))}
            />
            <LayoutInset space="none" blockStart="lg">
              <Switch
                label={tPage('fields.active.label')}
                description={tPage('fields.active.description')}
                {...fieldBindings(form.getInputProps('isActive', { type: 'checkbox' }))}
              />
            </LayoutInset>
          </DsLayoutInline>

          {renderConfigFields(form.values.type)}

          {!isEdit && form.values.type !== 'logging' && (
            <>
              <SectionHeader title={tPage('preSaveTest.title')} />
              <DsLayoutInline align="end" grow>
                <TextInput
                  label={tPage('preSaveTest.emailLabel')}
                  placeholder={tCommonPlaceholders('testEmail')}
                  type="email"
                  value={createTestEmail}
                  onChange={(event) => setCreateTestEmail(event.currentTarget.value)}
                />
                <Button
                  type="button"
                  emphasis="medium"
                  onClick={handleTestCreateConfig}
                  loading={testConfigMutation.isPending}
                  disabled={!createTestEmail || createMutation.isPending}
                >
                  {tPage('preSaveTest.action')}
                </Button>
              </DsLayoutInline>
              <SupportingText tone={isCreateReady ? 'positive' : 'secondary'}>
                {isCreateReady ? tPage('preSaveTest.ready') : tPage('preSaveTest.pending')}
              </SupportingText>
            </>
          )}

          {(createMutation.isPending || updateMutation.isPending) && (
            <SupportingText tone="secondary">{tPage('states.saving')}</SupportingText>
          )}

          <DsLayoutInset blockStart="md">
            <DialogActions>
              <Button
                type="button"
                emphasis="low"
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={() => {
                  if (isEdit) {
                    setEditAdapter(null);
                  } else {
                    closeCreate();
                    resetCreateTestState();
                  }
                  form.reset();
                }}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button
                emphasis="strong"
                type="submit"
                loading={isEdit ? updateMutation.isPending : createMutation.isPending}
                disabled={!isEdit && !isCreateReady}
              >
                {isEdit ? tCommon('actions.save') : tCommon('actions.createItem', { item: tPage('entity') })}
              </Button>
            </DialogActions>
          </DsLayoutInset>
        </DsLayoutStack>
      </form>
    </ContentModal>
  );

  return (
    <DsLayoutStack gap="lg">
      <QueryErrorAlert queries={[adaptersQuery]} />
      <DsHeading level={2}>{tPage('title')}</DsHeading>

      <SupportingText tone="secondary">{tPage('description')}</SupportingText>

      <DsLayoutStack gap="md">
        <SectionHeader
          title={tPage('sections.adapters.title')}
          description={tPage('sections.adapters.description')}
          actions={
            <Button emphasis="medium" leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
              {tPage('actions.addAdapter')}
            </Button>
          }
        />

        {adaptersQuery.isError ? null : isLoading ? (
          <SupportingText role="status" tone="secondary">
            {tCommon('states.loading')}
          </SupportingText>
        ) : adapters.length === 0 ? (
          <DsSectionCard padding="lg">
            <EmptyState
              inset="none"
              icon={IconMail}
              title={tPage('empty')}
              description={tPage('emptyDescription')}
              live
            />
          </DsSectionCard>
        ) : (
          <DsLayoutStack gap="sm">
            {adapters.map((adapter) => (
              <DsSectionCard padding="md" key={adapter.id}>
                <DsLayoutStack gap="md" role="group" aria-label={adapter.name}>
                  <DsLayoutInline justify="between" align="start" wrap="wrap">
                    <DsLayoutStack gap="xxs">
                      <TextButton
                        appearance="default"
                        size="md"
                        weight="semibold"
                        aria-label={`${adapter.name} ${tCommon('actions.edit')}`}
                        onClick={() => openEditModal(adapter)}
                      >
                        {adapter.name}
                      </TextButton>
                      <DsLayoutInline gap="xs" wrap="wrap">
                        {getAdapterTypeBadge(adapter.type)}
                        <LabelBadge tone={adapter.isActive ? 'positive' : 'neutral'}>
                          {adapter.isActive ? tCommon('statuses.active') : tCommon('statuses.inactive')}
                        </LabelBadge>
                      </DsLayoutInline>
                      <DsText size="sm" tone="secondary">
                        {tPage('row.priorityValue', { value: adapter.priority })}
                      </DsText>
                    </DsLayoutStack>

                    <Switch
                      checked={adapter.isActive}
                      label={tPage('row.enableAdapter')}
                      aria-label={`${tPage('row.enableAdapter')} ${adapter.name}`}
                      onChange={(e) =>
                        toggleMutation.mutate({
                          id: adapter.id,
                          isActive: e.currentTarget.checked,
                        })
                      }
                      disabled={toggleMutation.isPending}
                    />
                  </DsLayoutInline>

                  <DsLayoutInline justify="between" align="end" wrap="wrap">
                    {adapter.type !== MailAdapterType.LOGGING ? (
                      <DsLayoutInline gap="xs" align="end" wrap="wrap">
                        <div style={{ minWidth: 220 }}>
                          <TextInput
                            size="sm"
                            label={tPage('row.testEmailLabel')}
                            aria-label={`${tPage('row.testEmailLabel')} ${adapter.name}`}
                            placeholder={tCommonPlaceholders('testEmail')}
                            value={testingId === adapter.id ? testEmail : ''}
                            onChange={(e) => {
                              setTestingId(adapter.id);
                              setTestEmail(e.target.value);
                            }}
                          />
                        </div>
                        <Button
                          emphasis="medium"
                          leftSection={<IconMail size={16} />}
                          aria-label={`${tPage('row.sendTestEmail')} ${adapter.name}`}
                          onClick={() => {
                            if (testEmail) {
                              testMutation.mutate({ id: adapter.id, email: testEmail });
                            }
                          }}
                          loading={testMutation.isPending && testingId === adapter.id}
                          disabled={!testEmail || testingId !== adapter.id}
                        >
                          {tPage('row.sendTestEmail')}
                        </Button>
                      </DsLayoutInline>
                    ) : (
                      <SupportingText tone="secondary">{tPage('config.logging.description')}</SupportingText>
                    )}

                    <DsLayoutInline gap="xs" wrap="wrap">
                      <Button
                        emphasis="medium"
                        aria-label={`${tCommon('actions.edit')} ${adapter.name}`}
                        onClick={() => openEditModal(adapter)}
                      >
                        {tCommon('actions.edit')}
                      </Button>
                      <IconButton
                        tone="danger"
                        emphasis="medium"
                        onClick={() => setDeleteAdapter(adapter)}
                        loading={deleteMutation.isPending}
                        aria-label={`${tCommon('actions.delete')} ${adapter.name}`}
                      >
                        <IconTrash size={16} />
                      </IconButton>
                    </DsLayoutInline>
                  </DsLayoutInline>
                </DsLayoutStack>
              </DsSectionCard>
            ))}
          </DsLayoutStack>
        )}
      </DsLayoutStack>

      {renderFormModal(false)}
      {renderFormModal(true)}
      <ConfirmationDialog
        intent="delete"
        opened={!!deleteAdapter}
        onClose={() => setDeleteAdapter(null)}
        onConfirm={() => {
          if (!deleteAdapter) {
            return;
          }

          deleteMutation.mutate(deleteAdapter.id, {
            onSettled: () => {
              setDeleteAdapter(null);
            },
          });
        }}
        title={tCommon('actions.delete')}
        message={tPage('confirmDelete')}
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteMutation.isPending}
      />
    </DsLayoutStack>
  );
}
