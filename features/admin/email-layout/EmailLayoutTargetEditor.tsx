'use client';
import type { ReactNode } from 'react';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { SectionCard as DsSectionCard } from '@/components/core/Section';
import {
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';

import { ScrollArea } from '@/components/core/Display';
import { useTranslations } from 'next-intl';
import type { MaterializedEmailLayoutUnit } from '@echovisionlab/geul-common/collaboration/email-layout';
import { Textarea } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';

interface EmailLayoutTargetEditorProps {
  units: readonly MaterializedEmailLayoutUnit[];
  isReady: boolean;
  loadingSurface: ReactNode;
  editable?: boolean;
  onChange: (handle: string, value: string) => void;
  onUseSource: (handle: string) => void;
}

function unitLabel(unit: MaterializedEmailLayoutUnit, textLabel: string): string {
  return unit.kind === 'text' ? textLabel : `${unit.element}[${unit.attribute}]`;
}

export function EmailLayoutTargetEditor({
  units,
  isReady,
  loadingSurface,
  editable = true,
  onChange,
  onUseSource,
}: EmailLayoutTargetEditorProps) {
  const t = useTranslations('adminList.emailLayouts.detail.targetEditor');

  if (!isReady) {
    return loadingSurface;
  }
  return (
    <ScrollArea size="fill">
      <DsLayoutInset space="sm">
        <DsLayoutStack gap="sm">
          <DsLayoutStack gap="xxs">
            <DsText size="sm" weight="strong">
              {t('title')}
            </DsText>
            <DsText size="xs" tone="secondary">
              {t('description')}
            </DsText>
          </DsLayoutStack>

          {units.length === 0 ? <SupportingText tone="secondary">{t('empty')}</SupportingText> : null}

          {units.map((unit) => (
            <DsSectionCard withBorder padding="sm" key={unit.handle}>
              <DsLayoutStack gap="xs">
                <Textarea
                  label={unitLabel(unit, t('textUnit'))}
                  description={t('sourceValue', { value: unit.sourceValue })}
                  value={unit.value}
                  onChange={(event) => onChange(unit.handle, event.currentTarget.value)}
                  disabled={!editable}
                  autosize
                  minRows={unit.kind === 'text' ? 2 : 1}
                  data-email-layout-unit={unit.handle}
                />
                <DsLayoutInline justify="between" gap="xs">
                  <DsText size="xs" tone="secondary">
                    {unit.localeValuePresent ? t('translatedValue') : t('sourceFallback')}
                  </DsText>
                  <TextButton
                    appearance="muted"
                    size="xs"
                    disabled={!editable || !unit.localeValuePresent}
                    onClick={() => onUseSource(unit.handle)}
                  >
                    {t('useSource')}
                  </TextButton>
                </DsLayoutInline>
              </DsLayoutStack>
            </DsSectionCard>
          ))}
        </DsLayoutStack>
      </DsLayoutInset>
    </ScrollArea>
  );
}
