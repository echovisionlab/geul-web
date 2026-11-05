'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useTranslations } from 'next-intl';

import { Textarea } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';

interface SummaryFieldCardProps {
  entityType: string;
  entityId: string;
  summary: string;
  summaryReadOnly?: boolean;
  onSummaryChange?: (summary: string) => void;
}

export function SummaryFieldCard({
  entityType,
  entityId,
  summary,
  summaryReadOnly = false,
  onSummaryChange,
}: SummaryFieldCardProps) {
  const t = useTranslations('summaryField');
  const tCommonLabels = useTranslations('common.labels');

  return (
    <SectionCard padding={{ base: 'none', sm: 'md' }}>
      <DsLayoutStack gap="md">
        <SectionHeader title={tCommonLabels('summary')} description={t('description')} />
        <Textarea
          id={`${entityType}-${entityId}-summary`}
          value={summary}
          onChange={(event) => onSummaryChange?.(event.currentTarget.value)}
          rows={3}
          readOnly={summaryReadOnly}
          placeholder={t('placeholders.summary')}
        />
      </DsLayoutStack>
    </SectionCard>
  );
}
