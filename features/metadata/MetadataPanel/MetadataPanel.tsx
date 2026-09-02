'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Code, List, Stack, Text } from '@mantine/core';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { buildMetadataHealthChecks, METADATA_HEALTH_CHECKS, type MetadataHealthCheck } from '@/lib/metadata/health';
import { joinUrl } from '@/lib/utils/url';
import classes from './MetadataPanel.module.css';

interface MetadataPanelProps {
  title: string;
  summary: string;
  routePath: string;
  canonicalOrigin: string;
  siteName: string;
  defaultImageUrl?: string | null;
  defaultSchemaType: string;
}

function trimmed(value: string) {
  return value.trim();
}

function normalizeMetadataHealthCheck(check: string): MetadataHealthCheck {
  switch (check) {
    case 'Summary is missing, so search/social descriptions will be empty.':
      return METADATA_HEALTH_CHECKS.missingDescription;
    case 'Effective title is long and may truncate in search or social previews.':
      return METADATA_HEALTH_CHECKS.longTitle;
    case 'Effective description is long and may truncate in search or social previews.':
      return METADATA_HEALTH_CHECKS.longDescription;
    default:
      return check as MetadataHealthCheck;
  }
}

export function MetadataPanel({
  title,
  summary,
  routePath,
  canonicalOrigin,
  siteName,
  defaultImageUrl,
  defaultSchemaType,
}: MetadataPanelProps) {
  const t = useTranslations('metadataPanel');
  const resolvedCanonicalUrl = joinUrl(canonicalOrigin, routePath.startsWith('/') ? routePath : `/${routePath}`);
  const effectiveTitle = trimmed(title);
  const effectiveDescription = trimmed(summary);
  const healthChecks = buildMetadataHealthChecks({
    effectiveTitle,
    effectiveDescription,
  });

  return (
    <SectionCard>
      <Stack gap="md">
        <SectionHeader title={t('title')} description={t('description')} />

        {healthChecks.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t('healthChecks')}
            </Text>
            <List size="sm" icon={<IconAlertTriangle size={16} className={classes.warningIcon} />}>
              {healthChecks.map((check) => (
                <List.Item key={check}>{t(`checks.${normalizeMetadataHealthCheck(check)}`)}</List.Item>
              ))}
            </List>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            {t('noWarnings')}
          </Text>
        )}

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {t('resolvedMetadata')}
          </Text>
          <Code block>
            {JSON.stringify(
              {
                title: effectiveTitle,
                description: effectiveDescription,
                canonicalUrl: resolvedCanonicalUrl,
                imageUrl: defaultImageUrl || null,
                schemaType: defaultSchemaType,
                siteName,
              },
              null,
              2,
            )}
          </Code>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
