'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SectionCard } from '@/components/core/Section';
import { Heading, LocaleCode, Text } from '@/components/core/Typography';
import { Alert } from '@/components/core/Alert';
import { EmptyState } from '@/components/core/EmptyState';
import { ConfirmationDialog } from '@/features/confirmation';
import type { LocalBackup } from '@/lib/collab/local-backups';

export interface LocalBackupsViewProps {
  entries: LocalBackup[];
  loading?: boolean;
  unavailable?: boolean;
  error?: boolean;
  pendingId?: string | null;
  onRefresh: () => void;
  onOpen: (entry: LocalBackup) => void;
  onDiscard: (entry: LocalBackup) => Promise<void>;
}

/** Account settings composition; all visual and control contracts stay with Core. */
export function LocalBackupsView({
  entries,
  loading,
  unavailable,
  error,
  pendingId,
  onRefresh,
  onOpen,
  onDiscard,
}: LocalBackupsViewProps) {
  const t = useTranslations('localBackups');
  const actions = useTranslations('common.actions');
  const format = useFormatter();
  const [discarding, setDiscarding] = useState<LocalBackup | null>(null);
  return (
    <SectionCard padding="none" appearance="plain" withBorder={false}>
      <LayoutStack gap="md">
        <LayoutInline justify="between" wrap="wrap">
          <Heading level={2} scale={4}>
            {t('title')}
          </Heading>
          <Button onClick={onRefresh} loading={loading} disabled={!!pendingId || unavailable}>
            {t('refresh')}
          </Button>
        </LayoutInline>
        <Text size="sm" tone="secondary">
          {t('description')}
        </Text>
        {error ? <Alert tone="danger">{t('error')}</Alert> : null}
        {unavailable ? (
          <Text size="sm" tone="secondary">
            {t('unavailable')}
          </Text>
        ) : loading && entries.length === 0 ? (
          <Text size="sm" role="status">
            {t('loading')}
          </Text>
        ) : entries.length === 0 && !error ? (
          <EmptyState title={t('empty')} live inset="none" />
        ) : null}
        <LayoutStack role="list" gap="md" aria-label={t('title')}>
          {entries.map((entry) => {
            const key = `${entry.database}:${entry.id}`;
            const kind = t(`kinds.${entry.documentKind}`);
            // Named by the title the editor showed; the id only identifies untitled backups.
            const name = entry.title ?? entry.entityId;
            return (
              <LayoutStack role="listitem" gap="xs" key={key}>
                {entry.title ? (
                  <Text size="sm" weight="medium" wrap="anywhere">
                    {entry.title}
                  </Text>
                ) : null}
                <LayoutInline gap="sm" wrap="wrap">
                  <Text
                    size="sm"
                    weight={entry.title ? undefined : 'medium'}
                    tone={entry.title ? 'secondary' : undefined}
                  >
                    {kind}
                  </Text>
                  <LocaleCode code={entry.locale} />
                  <Text size="sm" tone="secondary">
                    {t('lastChanged', {
                      time: format.dateTime(new Date(entry.updatedAt), { dateStyle: 'medium', timeStyle: 'short' }),
                    })}
                  </Text>
                </LayoutInline>
                {entry.title ? null : (
                  <Text size="xs" tone="secondary" wrap="anywhere">
                    {entry.entityId}
                  </Text>
                )}
                <LayoutInline gap="action-group" wrap="wrap">
                  <Button
                    onClick={() => onOpen(entry)}
                    disabled={!!pendingId}
                    aria-label={t('openLabel', { kind, id: name, locale: entry.locale })}
                  >
                    {t('open')}
                  </Button>
                  <Button
                    onClick={() => setDiscarding(entry)}
                    disabled={!!pendingId}
                    aria-label={t('discardLabel', { kind, id: name, locale: entry.locale })}
                  >
                    {t('discard')}
                  </Button>
                </LayoutInline>
              </LayoutStack>
            );
          })}
        </LayoutStack>
        <ConfirmationDialog
          intent="discard"
          opened={discarding !== null}
          onClose={() => {
            if (!pendingId) {
              setDiscarding(null);
            }
          }}
          onConfirm={() => {
            if (discarding) {
              void onDiscard(discarding).then(() => setDiscarding(null));
            }
          }}
          title={t('discardTitle')}
          message={t('discardDescription')}
          confirmLabel={t('discard')}
          cancelLabel={actions('cancel')}
          closeLabel={actions('close')}
          loading={!!pendingId}
        />
      </LayoutStack>
    </SectionCard>
  );
}
