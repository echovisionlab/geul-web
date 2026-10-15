'use client';
import { SupportingText, Code, List, Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { StatusIcon } from '@/components/core/Display';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { buildMetadataHealthChecks, METADATA_HEALTH_CHECKS, type MetadataHealthCheck } from '@/lib/metadata/health';
import { joinUrl } from '@/lib/utils/url';
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
    <SectionCard padding={{ base: 'none', sm: 'md' }}>
      <DsLayoutStack gap="md">
        <SectionHeader title={t('title')} description={t('description')} />

        {healthChecks.length > 0 ? (
          <DsLayoutStack gap="xs">
            <DsText size="sm" weight="medium">
              {t('healthChecks')}
            </DsText>
            <List size="sm" icon={<StatusIcon icon={IconAlertTriangle} tone="warning" />}>
              {healthChecks.map((check) => (
                <List.Item key={check}>{t(`checks.${normalizeMetadataHealthCheck(check)}`)}</List.Item>
              ))}
            </List>
          </DsLayoutStack>
        ) : (
          <SupportingText tone="secondary">{t('noWarnings')}</SupportingText>
        )}

        <DsLayoutStack gap="xxs">
          <DsText size="sm" weight="medium">
            {t('resolvedMetadata')}
          </DsText>
          <Code block wrap="anywhere">
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
        </DsLayoutStack>
      </DsLayoutStack>
    </SectionCard>
  );
}
