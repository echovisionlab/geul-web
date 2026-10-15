'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import { MetadataPair } from '@/components/core/PublicMetadata';
import { IconPlugConnected } from '@tabler/icons-react';
import { LabelBadge } from '@/components/core/Badge';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { TextButton } from '@/components/core/TextButton';

interface McpIntegrationSettingsViewProps {
  endpoint: string;
  setupGuideUrl: string;
  labels: {
    title: string;
    description: string;
    endpoint: string;
    openGuide: string;
  };
}

export function McpIntegrationSettingsView({ endpoint, setupGuideUrl, labels }: McpIntegrationSettingsViewProps) {
  return (
    <DsLayoutStack gap="md" data-testid="settings-mcp-integration">
      <SectionHeader
        title={
          <span role="heading" aria-level={2}>
            {labels.title}
          </span>
        }
        description={
          <DsLayoutStack gap="xxs">
            <span>{labels.description}</span>
            <TextButton href={setupGuideUrl} target="_blank" rel="noreferrer" size="xs" appearance="accent">
              {labels.openGuide}
            </TextButton>
          </DsLayoutStack>
        }
      />
      <SectionCard appearance="plain" padding="none">
        <DsLayoutStack gap="sm">
          <DsLayoutInline gap="xs">
            <IconPlugConnected size={18} aria-hidden />
            <LabelBadge tone="neutral" appearance="outline">
              OAuth 2.1
            </LabelBadge>
          </DsLayoutInline>
          <MetadataPair label={<VisuallyHidden>{labels.endpoint}</VisuallyHidden>} layout="stacked">
            <DsText size="sm" font="mono" wrap="anywhere">
              {endpoint}
            </DsText>
          </MetadataPair>
        </DsLayoutStack>
      </SectionCard>
    </DsLayoutStack>
  );
}
