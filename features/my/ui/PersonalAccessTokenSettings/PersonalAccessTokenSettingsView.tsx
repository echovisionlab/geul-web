'use client';

import { useState } from 'react';
import { Code, Group, Stack, Text } from '@mantine/core';
import { IconCopy, IconKey, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { ConfirmModal, ContentModal } from '@/components/core/Modal';
import { SectionCard, SectionHeader } from '@/components/core/Section';

export interface PersonalAccessTokenViewModel {
  id: string;
  createdAtLabel: string;
  canRegenerate: boolean;
}

export interface PersonalAccessTokenSecretViewModel {
  value: string;
}

export interface PersonalAccessTokenSettingsLabels {
  title: string;
  description: string;
  empty: string;
  created: string;
  create: string;
  regenerate: string;
  delete: string;
  copy: string;
  cancel: string;
  close: string;
  regenerateTitle: string;
  regenerateConfirmation: string;
  deleteTitle: string;
  deleteConfirmation: string;
  oneTimeTitle: string;
  oneTimeWarning: string;
  secret: string;
  loadFailed: string;
}

interface PersonalAccessTokenSettingsViewProps {
  token: PersonalAccessTokenViewModel | null;
  labels: PersonalAccessTokenSettingsLabels;
  loadFailed?: boolean;
  pendingAction?: 'create' | `regenerate:${string}` | `delete:${string}` | null;
  secret?: PersonalAccessTokenSecretViewModel | null;
  onCreate: () => Promise<boolean>;
  onRegenerate: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onCopySecret: (secret: string) => void;
  onCloseSecret: () => void;
}

type Confirmation = 'regenerate' | 'delete' | null;

export function PersonalAccessTokenSettingsView({
  token,
  labels,
  loadFailed = false,
  pendingAction = null,
  secret = null,
  onCreate,
  onRegenerate,
  onDelete,
  onCopySecret,
  onCloseSecret,
}: PersonalAccessTokenSettingsViewProps) {
  const [confirmation, setConfirmation] = useState<Confirmation>(null);

  const confirmMutation = async () => {
    if (!confirmation || !token) {
      return;
    }
    const succeeded = confirmation === 'regenerate' ? await onRegenerate(token.id) : await onDelete(token.id);
    if (succeeded) {
      setConfirmation(null);
    }
  };

  const confirmationPending = token && confirmation ? pendingAction === `${confirmation}:${token.id}` : false;

  return (
    <>
      <SectionHeader
        title={labels.title}
        description={labels.description}
        actions={
          token || loadFailed ? null : (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} aria-hidden />}
              onClick={() => void onCreate()}
              loading={pendingAction === 'create'}
              disabled={pendingAction !== null}
              data-testid="security-create-personal-access-token"
            >
              {labels.create}
            </Button>
          )
        }
      />

      {loadFailed ? (
        <Alert tone="danger" mt="sm" data-testid="security-personal-access-token-load-error">
          <Text size="sm">{labels.loadFailed}</Text>
        </Alert>
      ) : !token ? (
        <SectionCard mt="sm" data-testid="security-personal-access-token-empty">
          <Group gap="sm">
            <IconKey size={18} aria-hidden />
            <Text size="sm" c="dimmed">
              {labels.empty}
            </Text>
          </Group>
        </SectionCard>
      ) : (
        <SectionCard mt="sm" p="sm" data-testid={`security-personal-access-token-${token.id}`}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="xs" c="dimmed">
              {labels.created}: {token.createdAtLabel}
            </Text>
            <Group gap="xs" wrap="nowrap">
              {token.canRegenerate ? (
                <Button
                  size="xs"
                  tone="neutral"
                  emphasis="medium"
                  leftSection={<IconRefresh size={14} aria-hidden />}
                  onClick={() => setConfirmation('regenerate')}
                  disabled={pendingAction !== null}
                  data-testid={`security-regenerate-personal-access-token-${token.id}`}
                >
                  {labels.regenerate}
                </Button>
              ) : null}
              <Button
                size="xs"
                tone="danger"
                emphasis="outline"
                leftSection={<IconTrash size={14} aria-hidden />}
                onClick={() => setConfirmation('delete')}
                disabled={pendingAction !== null}
                data-testid={`security-delete-personal-access-token-${token.id}`}
              >
                {labels.delete}
              </Button>
            </Group>
          </Group>
        </SectionCard>
      )}

      <ConfirmModal
        opened={confirmation !== null}
        onClose={() => {
          if (!confirmationPending) {
            setConfirmation(null);
          }
        }}
        onConfirm={() => void confirmMutation()}
        title={confirmation === 'regenerate' ? labels.regenerateTitle : labels.deleteTitle}
        message={confirmation === 'regenerate' ? labels.regenerateConfirmation : labels.deleteConfirmation}
        confirmLabel={confirmation === 'regenerate' ? labels.regenerate : labels.delete}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        confirmTone={confirmation === 'delete' ? 'danger' : 'accent'}
        loading={Boolean(confirmationPending)}
      />

      <ContentModal
        opened={secret !== null}
        onClose={onCloseSecret}
        title={labels.oneTimeTitle}
        closeLabel={labels.close}
        centered
      >
        <Stack gap="md" data-testid="security-personal-access-token-secret">
          <Alert tone="warning">
            <Text size="sm">{labels.oneTimeWarning}</Text>
          </Alert>
          <Text size="xs" c="dimmed">
            {labels.secret}
          </Text>
          <Code block style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', userSelect: 'all' }}>
            {secret?.value}
          </Code>
          <Group justify="flex-end">
            <Button tone="neutral" emphasis="medium" onClick={onCloseSecret}>
              {labels.close}
            </Button>
            <Button
              leftSection={<IconCopy size={14} aria-hidden />}
              onClick={() => secret && onCopySecret(secret.value)}
              data-testid="security-copy-personal-access-token-secret"
            >
              {labels.copy}
            </Button>
          </Group>
        </Stack>
      </ContentModal>
    </>
  );
}
