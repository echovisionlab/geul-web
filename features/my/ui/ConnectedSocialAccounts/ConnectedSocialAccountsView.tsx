'use client';

import type { ReactNode } from 'react';
import { IconLink, IconUnlink } from '@tabler/icons-react';
import { Box, Group, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';

export type ConnectedSocialProvider = 'google' | 'github';
export type SocialUnlinkBlockedReason = 'last_method' | 'primary_email';

export interface ConnectedSocialAccountsLabels {
  connect: string;
  connected: string;
  description: string;
  disconnect: string;
  lastMethod: string;
  notConnected: string;
  primaryEmailRequired: string;
  providerName: (provider: ConnectedSocialProvider) => string;
  title: string;
}

interface ConnectedSocialAccountsViewProps {
  availableProviders: ConnectedSocialProvider[];
  connectedProviders: ConnectedSocialProvider[];
  labels: ConnectedSocialAccountsLabels;
  linkingProvider: ConnectedSocialProvider | null;
  onLink: (provider: ConnectedSocialProvider) => void;
  onUnlink: (provider: ConnectedSocialProvider) => void;
  providerIcon: (provider: ConnectedSocialProvider) => ReactNode;
  unlinkBlockedReasons: Partial<Record<ConnectedSocialProvider, SocialUnlinkBlockedReason>>;
  unlinkingProvider: ConnectedSocialProvider | null;
}

function ProviderBadge({ children, dimmed = false }: { children: ReactNode; dimmed?: boolean }) {
  return (
    <Box
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: dimmed ? 0.7 : 1,
      }}
    >
      {children}
    </Box>
  );
}

export function ConnectedSocialAccountsView({
  availableProviders,
  connectedProviders,
  labels,
  linkingProvider,
  onLink,
  onUnlink,
  providerIcon,
  unlinkBlockedReasons,
  unlinkingProvider,
}: ConnectedSocialAccountsViewProps) {
  return (
    <>
      <SectionHeader title={labels.title} description={labels.description} />

      <Stack gap="sm" data-testid="security-connected-accounts-section">
        {connectedProviders.map((provider) => {
          const isUnlinking = unlinkingProvider === provider;
          const blockedReason = unlinkBlockedReasons[provider];
          const disabledReason =
            blockedReason === 'primary_email'
              ? labels.primaryEmailRequired
              : blockedReason === 'last_method'
                ? labels.lastMethod
                : undefined;

          return (
            <SectionCard key={provider} p="sm" data-testid={`security-provider-${provider}`}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <ProviderBadge>{providerIcon(provider)}</ProviderBadge>
                  <Box>
                    <Text size="sm" fw={500}>
                      {labels.providerName(provider)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {labels.connected}
                    </Text>
                  </Box>
                </Group>
                <Tooltip label={disabledReason ?? labels.disconnect} withArrow>
                  <span>
                    <IconButton
                      tone="neutral"
                      emphasis="low"
                      aria-label={`${labels.disconnect} ${labels.providerName(provider)}`}
                      onClick={() => onUnlink(provider)}
                      loading={isUnlinking}
                      disabled={isUnlinking || Boolean(disabledReason)}
                      data-testid={`security-disconnect-${provider}`}
                    >
                      <IconUnlink size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Group>
            </SectionCard>
          );
        })}

        {availableProviders.map((provider) => {
          const isLinking = linkingProvider === provider;

          return (
            <SectionCard key={provider} p="sm" style={{ opacity: 0.7 }} data-testid={`security-provider-${provider}`}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <ProviderBadge dimmed>{providerIcon(provider)}</ProviderBadge>
                  <Box>
                    <Text size="sm" fw={500} c="dimmed">
                      {labels.providerName(provider)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {labels.notConnected}
                    </Text>
                  </Box>
                </Group>
                <Button
                  emphasis="medium"
                  size="xs"
                  leftSection={<IconLink size={14} />}
                  onClick={() => onLink(provider)}
                  loading={isLinking}
                  data-testid={`security-connect-${provider}`}
                >
                  {labels.connect}
                </Button>
              </Group>
            </SectionCard>
          );
        })}
      </Stack>
    </>
  );
}
