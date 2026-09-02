'use client';

import { IconCheck, IconMail } from '@tabler/icons-react';
import { Badge, Box, Group, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { SectionCard, SectionHeader } from '@/components/core/Section';
export interface AccountEmailSettingsLabels {
  canonical: string;
  change: string;
  description: string;
  emailCode: string;
  title: string;
}

interface AccountEmailSettingsViewProps {
  email: string;
  emailCodeAvailable: boolean;
  labels: AccountEmailSettingsLabels;
  onChangeEmail: () => void;
}

export function AccountEmailSettingsView({
  email,
  emailCodeAvailable,
  labels,
  onChangeEmail,
}: AccountEmailSettingsViewProps) {
  return (
    <>
      <SectionHeader title={labels.title} description={labels.description} />

      <SectionCard p="sm" data-testid="security-account-email">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Box
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconMail size={18} aria-hidden />
            </Box>
            <Stack gap={5} style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {email || '—'}
              </Text>
              <Group gap={6}>
                <LabelBadge
                  size="sm"
                  tone="accent"
                  appearance="soft"
                  leftSection={<IconCheck size={11} />}
                  data-testid="security-primary-email"
                >
                  {labels.canonical}
                </LabelBadge>
                {emailCodeAvailable ? (
                  <Badge size="sm" variant="light" color="gray">
                    {labels.emailCode}
                  </Badge>
                ) : null}
              </Group>
            </Stack>
          </Group>
          <Button
            size="xs"
            tone="neutral"
            emphasis="medium"
            onClick={onChangeEmail}
            data-testid="security-change-email"
          >
            {labels.change}
          </Button>
        </Group>
      </SectionCard>
    </>
  );
}
