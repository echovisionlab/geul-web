'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import { useId, type ReactNode } from 'react';
import { IconLink, IconUnlink } from '@tabler/icons-react';
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
  const scopeId = useId();
  return (
    <DsLayoutStack gap="md">
      <SectionHeader
        title={
          <span role="heading" aria-level={2}>
            {labels.title}
          </span>
        }
        description={labels.description}
      />

      <DsLayoutStack gap="sm" data-testid="security-connected-accounts-section">
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
            <SectionCard
              appearance="plain"
              key={provider}
              padding="sm"
              data-testid={`security-provider-${provider}`}
              role="group"
              aria-labelledby={`${scopeId}-${provider}-name`}
              aria-describedby={disabledReason ? `${scopeId}-${provider}-reason` : undefined}
            >
              <DsLayoutInline justify="between" wrap="nowrap">
                <DsLayoutInline gap="sm" wrap="nowrap">
                  {providerIcon(provider)}
                  <div>
                    <DsText id={`${scopeId}-${provider}-name`} size="sm" weight="medium">
                      {labels.providerName(provider)}
                    </DsText>
                    <DsText id={`${scopeId}-${provider}-status`} size="xs" tone="secondary">
                      {labels.connected}
                    </DsText>
                  </div>
                </DsLayoutInline>
                <Tooltip label={disabledReason ?? labels.disconnect} withArrow>
                  <span>
                    <IconButton
                      tone="neutral"
                      emphasis="low"
                      aria-label={labels.disconnect}
                      aria-describedby={`${scopeId}-${provider}-name ${scopeId}-${provider}-status${disabledReason ? ` ${scopeId}-${provider}-reason` : ''}`}
                      onClick={() => onUnlink(provider)}
                      loading={isUnlinking}
                      disabled={isUnlinking || Boolean(disabledReason)}
                      data-testid={`security-disconnect-${provider}`}
                    >
                      <IconUnlink size={16} aria-hidden />
                    </IconButton>
                  </span>
                </Tooltip>
              </DsLayoutInline>
              {disabledReason ? (
                <VisuallyHidden id={`${scopeId}-${provider}-reason`}>{disabledReason}</VisuallyHidden>
              ) : null}
            </SectionCard>
          );
        })}

        {availableProviders.map((provider) => {
          const isLinking = linkingProvider === provider;

          return (
            <SectionCard
              appearance="plain"
              key={provider}
              padding="sm"
              data-testid={`security-provider-${provider}`}
              role="group"
              aria-labelledby={`${scopeId}-${provider}-name`}
            >
              <DsLayoutInline justify="between" wrap="nowrap">
                <DsLayoutInline gap="sm" wrap="nowrap">
                  {providerIcon(provider)}
                  <div>
                    <DsText id={`${scopeId}-${provider}-name`} size="sm" weight="medium" tone="secondary">
                      {labels.providerName(provider)}
                    </DsText>
                    <DsText id={`${scopeId}-${provider}-status`} size="xs" tone="secondary">
                      {labels.notConnected}
                    </DsText>
                  </div>
                </DsLayoutInline>
                <Button
                  emphasis="medium"
                  size="xs"
                  leftSection={<IconLink size={14} aria-hidden />}
                  aria-describedby={`${scopeId}-${provider}-name ${scopeId}-${provider}-status`}
                  onClick={() => onLink(provider)}
                  loading={isLinking}
                  data-testid={`security-connect-${provider}`}
                >
                  {labels.connect}
                </Button>
              </DsLayoutInline>
            </SectionCard>
          );
        })}
      </DsLayoutStack>
    </DsLayoutStack>
  );
}
