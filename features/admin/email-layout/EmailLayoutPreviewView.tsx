'use client';

import { useMemo } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Group, Loader, Stack, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Tooltip } from '@/components/core/Tooltip';
import { buildEmailPreviewSrcDoc } from '@/lib/email/preview-document';
import type { EmailLayoutValidationError } from '@/lib/types/email-layout/validation';

export interface EmailLayoutPreviewViewProps {
  previewHtml: string;
  errors?: EmailLayoutValidationError[];
  isLoading?: boolean;
  locale?: string;
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

export function EmailLayoutPreviewView({
  previewHtml,
  errors = [],
  isLoading = false,
  locale,
}: EmailLayoutPreviewViewProps) {
  const t = useTranslations('adminList.emailLayouts.detail');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const previewSrcDoc = useMemo(() => buildEmailPreviewSrcDoc(previewHtml, locale), [locale, previewHtml]);

  return (
    <Stack gap={0} style={{ minHeight: 0, height: '100%' }}>
      <Group justify="space-between" mb={4}>
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {tCommonLabels('preview')}
          </Text>
          {isLoading ? <Loader size={12} /> : null}
        </Group>
        <Tooltip label={t('preview.serverHelp')} multiline w={280}>
          <Text size="xs" c="dimmed" style={{ cursor: 'help' }}>
            {t('preview.serverLabel')}
          </Text>
        </Tooltip>
      </Group>

      {errors.length > 0 ? (
        <Alert icon={<IconAlertTriangle size={16} />} tone="danger" mb="xs" p="xs">
          <Stack gap={4}>
            {errors.map((error, index) => (
              <Text key={`${error.code}:${index}`} size="xs">
                <Text span fw={500}>
                  {error.code}
                </Text>
                :{' '}
                {error.code in LAYOUT_ERROR_MESSAGE_KEYS
                  ? t(LAYOUT_ERROR_MESSAGE_KEYS[error.code as keyof typeof LAYOUT_ERROR_MESSAGE_KEYS])
                  : error.message}
                {error.line != null ? ` (${t('preview.errorLocation', { line: error.line })})` : null}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      <Box
        style={{
          flex: 1,
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-default)',
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {previewSrcDoc ? (
          <iframe
            srcDoc={previewSrcDoc}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={t('preview.iframeTitle')}
          />
        ) : (
          <Stack align="center" justify="center" h="100%">
            <Text c="dimmed">{isLoading ? tCommonStates('loadingPreview') : t('preview.empty')}</Text>
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
