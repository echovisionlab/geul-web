'use client';

import { Code, Group, Stack, Text } from '@mantine/core';
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
    <Stack gap="sm" data-testid="settings-mcp-integration">
      <SectionHeader
        title={labels.title}
        description={
          <Stack gap={2}>
            <span>{labels.description}</span>
            <TextButton href={setupGuideUrl} target="_blank" rel="noreferrer" size="xs" appearance="accent">
              {labels.openGuide}
            </TextButton>
          </Stack>
        }
      />
      <SectionCard p="sm">
        <Stack gap="sm">
          <Group gap="xs">
            <IconPlugConnected size={18} aria-hidden />
            <LabelBadge tone="neutral" appearance="outline">
              OAuth 2.1
            </LabelBadge>
          </Group>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {labels.endpoint}
            </Text>
            <Code block style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', userSelect: 'all' }}>
              {endpoint}
            </Code>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
