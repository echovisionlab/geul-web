'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SectionCard } from '@/components/core/Section';
import { Heading, Text } from '@/components/core/Typography';
import { Alert } from '@/components/core/Alert';
import { EmptyState } from '@/components/core/EmptyState';
import { ConfirmationDialog } from '@/features/confirmation';

export interface LocalBackupsViewProps {
  /** Unsaved edits from closed tabs. The editor recovers them when their document is opened again. */
  count: number;
  /** Approximate total size in bytes. */
  bytes: number;
  loading?: boolean;
  unavailable?: boolean;
  error?: boolean;
  clearing?: boolean;
  onRefresh: () => void;
  onClear: () => Promise<void>;
}

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/** Account settings composition; all visual and control contracts stay with Core. */
export function LocalBackupsView({
  count,
  bytes,
  loading,
  unavailable,
  error,
  clearing,
  onRefresh,
  onClear,
}: LocalBackupsViewProps) {
  const t = useTranslations('localBackups');
  const actions = useTranslations('common.actions');
  const format = useFormatter();
  const [confirming, setConfirming] = useState(false);
  const exponent = Math.min(BYTE_UNITS.length - 1, bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(1024)) : 0);
  const size = format.number(bytes / 1024 ** exponent, {
    style: 'unit',
    unit: BYTE_UNITS[exponent],
    unitDisplay: 'short',
    maximumFractionDigits: exponent === 0 ? 0 : 1,
  });
  return (
    <SectionCard padding="none" appearance="plain" withBorder={false}>
      <LayoutStack gap="md">
        <LayoutInline justify="between" wrap="wrap">
          <Heading level={2} scale={4}>
            {t('title')}
          </Heading>
          <Button onClick={onRefresh} loading={loading} disabled={clearing || unavailable}>
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
        ) : loading && count === 0 ? (
          <Text size="sm" role="status">
            {t('loading')}
          </Text>
        ) : count === 0 ? (
          error ? null : (
            <EmptyState title={t('empty')} live inset="none" />
          )
        ) : (
          <LayoutInline justify="between" gap="sm" wrap="wrap">
            <Text size="sm" role="status">
              {t('summary', { count, size })}
            </Text>
            <Button onClick={() => setConfirming(true)} disabled={clearing}>
              {t('clear')}
            </Button>
          </LayoutInline>
        )}
        <ConfirmationDialog
          intent="discard"
          opened={confirming}
          onClose={() => {
            if (!clearing) {
              setConfirming(false);
            }
          }}
          onConfirm={() => {
            void onClear().then(() => setConfirming(false));
          }}
          title={t('clearTitle')}
          message={t('clearDescription')}
          confirmLabel={t('clear')}
          cancelLabel={actions('cancel')}
          closeLabel={actions('close')}
          loading={!!clearing}
        />
      </LayoutStack>
    </SectionCard>
  );
}
