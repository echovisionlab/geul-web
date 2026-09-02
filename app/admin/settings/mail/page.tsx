'use client';

import { useState } from 'react';
import { MailAdapterType } from '@echovisionlab/geul-proto/secure/mail_adapter_pb.ts';
import { IconMail, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Divider, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { badgeToneFromColor, LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { PasswordInput, Select, TextInput, NumberInput, Switch } from '@/components/core/Input';
import { ConfirmModal } from '@/components/core/Modal';
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

export default function MailAdaptersPage() {
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

  const { data, isLoading } = useQuery({
    queryKey: ['mailAdapters'],
    queryFn: () => listMailAdaptersAction(),
  });

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
        return <LabelBadge tone={badgeToneFromColor('orange')}>{tPage('badges.ses')}</LabelBadge>;
      case MailAdapterType.SMTP:
        return <LabelBadge tone={badgeToneFromColor('blue')}>{tPage('badges.smtp')}</LabelBadge>;
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
    mutationFn: createMailAdapterAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('notifications.created'), color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['mailAdapters'] });
      closeCreate();
      resetCreateTestState();
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateMailAdapterAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('notifications.updated'), color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['mailAdapters'] });
      setEditAdapter(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMailAdapterAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('notifications.deleted'), color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['mailAdapters'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleMailAdapterAction(id, isActive),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['mailAdapters'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => testMailAdapterAction(id, email),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({
          message: tPage('notifications.testFailed', { error: result.error }),
          color: 'red',
        });
      } else if (result.success) {
        notifications.show({ message: tPage('notifications.testSent'), color: 'green' });
      }
      setTestingId(null);
    },
  });

  const testConfigMutation = useMutation({
    mutationFn: (input: { values: MailAdapterFormValues; email: string }) =>
      testMailAdapterConfigAction({
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
          color: 'red',
        });
        setVerifiedCreateFingerprint(null);
        return;
      }
      notifications.show({ message: tPage('notifications.configTestPassed'), color: 'green' });
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
      notifications.show({ message: tPage('notifications.enterTestEmail'), color: 'red' });
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
        color: 'red',
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
        color: 'red',
      });
      return;
    }

    if (shouldUpdateConfig && values.type === 'smtp' && !values.smtpPassword.trim()) {
      notifications.show({
        message: tPage('notifications.smtpPasswordRequired'),
        color: 'red',
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
          <Divider label={tPage('config.ses.sectionTitle')} labelPosition="left" />
          <TextInput
            label={tCommon('labels.region')}
            placeholder={tPage('config.ses.region.placeholder')}
            {...form.getInputProps('sesRegion')}
          />
          <TextInput
            label={tPage('config.ses.accessKeyId.label')}
            placeholder={tPage('config.ses.accessKeyId.placeholder')}
            {...form.getInputProps('sesAccessKeyId')}
          />
          <PasswordInput
            label={tPage('config.ses.secretAccessKey.label')}
            placeholder={tPage('config.ses.secretAccessKey.placeholder')}
            description={editAdapter ? tPage('config.ses.secretAccessKey.descriptionEdit') : undefined}
            {...form.getInputProps('sesSecretAccessKey')}
          />
          <TextInput
            label={tCommon('labels.fromEmail')}
            placeholder={tCommon('placeholders.noReplyEmail')}
            {...form.getInputProps('sesFromEmail')}
          />
          <TextInput
            label={tCommon('labels.fromNameOptional')}
            placeholder={tPage('config.ses.fromName.placeholder')}
            {...form.getInputProps('sesFromName')}
          />
        </>
      );
    }

    if (type === 'smtp') {
      return (
        <>
          <Divider label={tPage('config.smtp.sectionTitle')} labelPosition="left" />
          <TextInput
            label={tPage('config.smtp.host.label')}
            placeholder={tPage('config.smtp.host.placeholder')}
            {...form.getInputProps('smtpHost')}
          />
          <Group grow>
            <NumberInput
              label={tPage('config.smtp.port.label')}
              placeholder={tPage('config.smtp.port.placeholder')}
              min={1}
              max={65535}
              {...form.getInputProps('smtpPort')}
            />
            <Switch
              label={tPage('config.smtp.secure.label')}
              description={tPage('config.smtp.secure.description')}
              mt={24}
              {...form.getInputProps('smtpSecure', { type: 'checkbox' })}
            />
          </Group>
          <TextInput
            label={tPage('config.smtp.user.label')}
            placeholder={tPage('config.smtp.user.placeholder')}
            {...form.getInputProps('smtpUser')}
          />
          <PasswordInput
            label={tCommon('labels.password')}
            placeholder={tCommonPlaceholders('password')}
            description={editAdapter ? tPage('config.smtp.password.descriptionEdit') : undefined}
            {...form.getInputProps('smtpPassword')}
          />
          <TextInput
            label={tCommon('labels.fromEmail')}
            placeholder={tCommon('placeholders.noReplyEmail')}
            {...form.getInputProps('smtpFromEmail')}
          />
          <TextInput
            label={tCommon('labels.fromNameOptional')}
            placeholder={tPage('config.smtp.fromName.placeholder')}
            {...form.getInputProps('smtpFromName')}
          />
        </>
      );
    }

    return (
      <Text size="sm" c="dimmed">
        {tPage('config.logging.description')}
      </Text>
    );
  };

  const renderFormModal = (isEdit: boolean) => (
    <Modal
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
      size="md"
    >
      <form onSubmit={form.onSubmit(isEdit ? handleUpdate : handleCreate)}>
        <Stack gap="md">
          <TextInput
            label={tCommon('labels.name')}
            placeholder={tPage('fields.namePlaceholder')}
            {...form.getInputProps('name')}
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
          <Group grow>
            <NumberInput
              label={tCommon('labels.priority')}
              description={tPage('fields.priority.description')}
              {...form.getInputProps('priority')}
            />
            <Switch
              label={tPage('fields.active.label')}
              description={tPage('fields.active.description')}
              mt={24}
              {...form.getInputProps('isActive', { type: 'checkbox' })}
            />
          </Group>

          {renderConfigFields(form.values.type)}

          {!isEdit && form.values.type !== 'logging' && (
            <>
              <Divider label={tPage('preSaveTest.title')} labelPosition="left" />
              <Group align="flex-end" grow>
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
              </Group>
              <Text size="sm" c={isCreateReady ? 'green' : 'dimmed'}>
                {isCreateReady ? tPage('preSaveTest.ready') : tPage('preSaveTest.pending')}
              </Text>
            </>
          )}

          {(createMutation.isPending || updateMutation.isPending) && (
            <Text size="sm" c="dimmed">
              {tPage('states.saving')}
            </Text>
          )}

          <Group justify="flex-end" mt="md">
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
              type="submit"
              loading={isEdit ? updateMutation.isPending : createMutation.isPending}
              disabled={!isEdit && !isCreateReady}
            >
              {isEdit ? tCommon('actions.save') : tCommon('actions.createItem', { item: tPage('entity') })}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );

  return (
    <Stack gap="lg">
      <Title order={2}>{tPage('title')}</Title>

      <Text c="dimmed">{tPage('description')}</Text>

      <Stack gap="md">
        <SectionHeader
          title={tPage('sections.adapters.title')}
          description={tPage('sections.adapters.description')}
          actions={
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
              {tPage('actions.addAdapter')}
            </Button>
          }
        />

        {isLoading ? (
          <Text c="dimmed">{tCommon('states.loading')}</Text>
        ) : adapters.length === 0 ? (
          <Paper withBorder p="lg" radius="md">
            <Stack gap={4} align="center">
              <IconMail size={28} opacity={0.35} />
              <Text fw={500}>{tPage('empty')}</Text>
              <Text size="sm" c="dimmed" ta="center">
                {tPage('emptyDescription')}
              </Text>
            </Stack>
          </Paper>
        ) : (
          <Stack gap="sm">
            {adapters.map((adapter) => (
              <Paper key={adapter.id} withBorder p="md" radius="md">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" wrap="wrap">
                    <Stack gap={6}>
                      <TextButton
                        appearance="default"
                        size="md"
                        weight="semibold"
                        onClick={() => openEditModal(adapter)}
                      >
                        {adapter.name}
                      </TextButton>
                      <Group gap="xs" wrap="wrap">
                        {getAdapterTypeBadge(adapter.type)}
                        <LabelBadge tone={adapter.isActive ? badgeToneFromColor('green') : 'neutral'}>
                          {adapter.isActive ? tCommon('statuses.active') : tCommon('statuses.inactive')}
                        </LabelBadge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {tPage('row.priorityValue', { value: adapter.priority })}
                      </Text>
                    </Stack>

                    <Switch
                      checked={adapter.isActive}
                      label={tPage('row.enableAdapter')}
                      onChange={(e) =>
                        toggleMutation.mutate({
                          id: adapter.id,
                          isActive: e.currentTarget.checked,
                        })
                      }
                      disabled={toggleMutation.isPending}
                    />
                  </Group>

                  <Group justify="space-between" align="flex-end" wrap="wrap">
                    {adapter.type !== MailAdapterType.LOGGING ? (
                      <Group gap="xs" align="flex-end" wrap="wrap">
                        <TextInput
                          size="sm"
                          label={tPage('row.testEmailLabel')}
                          placeholder={tCommonPlaceholders('testEmail')}
                          value={testingId === adapter.id ? testEmail : ''}
                          onChange={(e) => {
                            setTestingId(adapter.id);
                            setTestEmail(e.target.value);
                          }}
                          style={{ minWidth: 220 }}
                        />
                        <Button
                          emphasis="medium"
                          leftSection={<IconMail size={16} />}
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
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">
                        {tPage('config.logging.description')}
                      </Text>
                    )}

                    <Group gap="xs" wrap="wrap">
                      <Button emphasis="low" onClick={() => openEditModal(adapter)}>
                        {tCommon('actions.edit')}
                      </Button>
                      <IconButton
                        tone="danger"
                        emphasis="medium"
                        onClick={() => setDeleteAdapter(adapter)}
                        loading={deleteMutation.isPending}
                        aria-label={tCommon('actions.delete')}
                      >
                        <IconTrash size={16} />
                      </IconButton>
                    </Group>
                  </Group>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>

      {renderFormModal(false)}
      {renderFormModal(true)}
      <ConfirmModal
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
    </Stack>
  );
}
