'use client';

import { EmailPreviewFrame } from '@/features/email/EmailPreviewFrame';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutInset,
} from '@/components/core/Layout';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { SectionCard } from '@/components/core/Section';
import { Spinner as Loader } from '@/components/core/Display';
import { Alert } from '@/components/core/Alert';
import { Tooltip } from '@/components/core/Tooltip';
import type { EmailLayoutValidationError } from '@/lib/types/email-layout/validation';

export interface EmailLayoutPreviewViewProps {
  previewHtml: string;
  errors?: EmailLayoutValidationError[];
  isLoading?: boolean;
}

const LAYOUT_ERROR_MESSAGE_KEYS = {
  EMPTY_CONTENT: 'preview.validationErrors.EMPTY_CONTENT',
  MISSING_CONTENT_PLACEHOLDER: 'preview.validationErrors.MISSING_CONTENT_PLACEHOLDER',
  MULTIPLE_CONTENT_PLACEHOLDERS: 'preview.validationErrors.MULTIPLE_CONTENT_PLACEHOLDERS',
  MULTIPLE_HTML_DOCUMENTS: 'preview.validationErrors.MULTIPLE_HTML_DOCUMENTS',
  UNCLOSED_TAG: 'preview.validationErrors.UNCLOSED_TAG',
  UNAUTHORIZED: 'preview.validationErrors.UNAUTHORIZED',
  UNKNOWN_ERROR: 'preview.validationErrors.UNKNOWN_ERROR',
} as const;

export function EmailLayoutPreviewView({ previewHtml, errors = [], isLoading = false }: EmailLayoutPreviewViewProps) {
  const t = useTranslations('adminList.emailLayouts.detail');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');

  return (
    <DsLayoutStack gap="none" role="region" aria-label={tCommonLabels('preview')} aria-busy={isLoading}>
      <DsLayoutInset blockEnd="xxs">
        <DsLayoutInline justify="between">
          <DsLayoutInline gap="xs">
            <DsText size="xs" tone="secondary">
              {tCommonLabels('preview')}
            </DsText>
            {isLoading ? <Loader size="xs" /> : null}
          </DsLayoutInline>
          <Tooltip label={t('preview.serverHelp')} multiline size="standard">
            <div style={{ cursor: 'help' }}>
              <DsText size="xs" tone="secondary">
                {t('preview.serverLabel')}
              </DsText>
            </div>
          </Tooltip>
        </DsLayoutInline>
      </DsLayoutInset>

      {errors.length > 0 ? (
        <LayoutInset space="none" blockEnd="xs">
          <Alert role="alert" density="compact" icon={<IconAlertTriangle size={16} />} tone="danger">
            <DsLayoutStack gap="xxs">
              {errors.map((error, index) => (
                <DsText key={`${error.code}:${index}`} size="xs">
                  <DsText as="span" weight="medium">
                    {error.code}
                  </DsText>
                  :{' '}
                  {error.code in LAYOUT_ERROR_MESSAGE_KEYS
                    ? t(LAYOUT_ERROR_MESSAGE_KEYS[error.code as keyof typeof LAYOUT_ERROR_MESSAGE_KEYS])
                    : error.message}
                  {error.line != null ? ` (${t('preview.errorLocation', { line: error.line })})` : null}
                </DsText>
              ))}
            </DsLayoutStack>
          </Alert>
        </LayoutInset>
      ) : null}

      <SectionCard padding="none" appearance="paper" clip grow>
        {previewHtml ? (
          <EmailPreviewFrame srcDoc={previewHtml} title={t('preview.iframeTitle')} />
        ) : (
          <DsLayoutStack align="center" justify="center" fill="block">
            <SupportingText tone="secondary">
              {isLoading ? tCommonStates('loadingPreview') : t('preview.empty')}
            </SupportingText>
          </DsLayoutStack>
        )}
      </SectionCard>
    </DsLayoutStack>
  );
}
