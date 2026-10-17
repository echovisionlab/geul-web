'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation/ui/ConfirmationDialog';

import { MetadataPair } from '@/components/core/PublicMetadata';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack, LayoutInset } from '@/components/core/Layout';

import { useState } from 'react';
import { IconCopy, IconKey, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { SectionCard, SectionHeader, type SectionHeaderLevel } from '@/components/core/Section';

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
  /** Outline level when the section is part of a settings page outline; omitted keeps the compact title. */
  headingLevel?: SectionHeaderLevel;
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
  headingLevel,
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
        level={headingLevel}
        title={
          headingLevel ? (
            labels.title
          ) : (
            <span role="heading" aria-level={2}>
              {labels.title}
            </span>
          )
        }
        description={labels.description}
        actions={
          token || loadFailed ? null : (
            <Button
              size="xs"
              emphasis="medium"
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
        <LayoutInset space="none" blockStart="sm">
          <Alert tone="danger" data-testid="security-personal-access-token-load-error">
            <DsText size="sm" tone="secondary">
              {labels.loadFailed}
            </DsText>
          </Alert>
        </LayoutInset>
      ) : !token ? (
        <LayoutInset space="none" blockStart="sm">
          <SectionCard appearance="plain" padding="none" data-testid="security-personal-access-token-empty">
            <DsLayoutInline gap="sm">
              <IconKey size={18} aria-hidden />
              <SupportingText tone="secondary">{labels.empty}</SupportingText>
            </DsLayoutInline>
          </SectionCard>
        </LayoutInset>
      ) : (
        <LayoutInset space="none" blockStart="sm">
          <SectionCard appearance="plain" padding="none" data-testid={`security-personal-access-token-${token.id}`}>
            <DsLayoutInline justify="between" align="center" wrap="wrap">
              <DsText size="xs" tone="secondary">
                {labels.created}: {token.createdAtLabel}
              </DsText>
              <DsLayoutInline gap="xs" wrap="nowrap">
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
                  emphasis="medium"
                  leftSection={<IconTrash size={14} aria-hidden />}
                  onClick={() => setConfirmation('delete')}
                  disabled={pendingAction !== null}
                  data-testid={`security-delete-personal-access-token-${token.id}`}
                >
                  {labels.delete}
                </Button>
              </DsLayoutInline>
            </DsLayoutInline>
          </SectionCard>
        </LayoutInset>
      )}

      <ConfirmationDialog
        intent={confirmation === 'delete' ? 'delete' : 'regenerate'}
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
        loading={Boolean(confirmationPending)}
      />

      <ContentModal
        opened={secret !== null}
        onClose={onCloseSecret}
        title={labels.oneTimeTitle}
        closeLabel={labels.close}
        centered
      >
        <DsLayoutStack gap="md" data-testid="security-personal-access-token-secret">
          <Alert tone="warning">
            <DsText size="sm">{labels.oneTimeWarning}</DsText>
          </Alert>
          <MetadataPair label={labels.secret} layout="stacked">
            <DsText size="sm" font="mono" wrap="anywhere">
              {secret?.value}
            </DsText>
          </MetadataPair>
          <DialogActions>
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
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
    </>
  );
}
