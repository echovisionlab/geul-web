'use client';

import Link from 'next/link';
import { Anchor, Collapse, Group, Paper, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { Switch } from '@/components/core/Input';

export interface CookieConsentLearnMoreSegment {
  text: string;
  href?: '/privacy' | '/terms';
}

export interface CookieConsentBannerViewModel {
  isOpen: boolean;
  requiresRenewal: boolean;
  showPreferences: boolean;
  analyticsEnabled: boolean;
  labels: {
    renewalNotice: string;
    intro: string;
    rejectNonEssential: string;
    hidePreferences: string;
    customize: string;
    acceptAll: string;
    essential: string;
    analytics: string;
    savePreferences: string;
  };
  learnMore: CookieConsentLearnMoreSegment[];
}

interface CookieConsentBannerViewProps {
  model: CookieConsentBannerViewModel;
  onRejectNonEssential: () => void;
  onTogglePreferences: () => void;
  onAcceptAll: () => void;
  onAnalyticsChange: (enabled: boolean) => void;
  onSavePreferences: () => void;
}

export function CookieConsentBannerView({
  model,
  onRejectNonEssential,
  onTogglePreferences,
  onAcceptAll,
  onAnalyticsChange,
  onSavePreferences,
}: CookieConsentBannerViewProps) {
  if (!model.isOpen) {
    return null;
  }

  return (
    <Paper
      className="print-hide"
      withBorder
      shadow="md"
      radius={0}
      p="md"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(16px + var(--safe-area-bottom))',
        maxWidth: 780,
        margin: '0 auto',
        zIndex: 999,
      }}
    >
      <Stack gap="sm">
        {model.requiresRenewal ? (
          <Text size="sm" fw={500} data-testid="cookie-consent-renewal-notice">
            {model.labels.renewalNotice}
          </Text>
        ) : (
          <Text size="sm">{model.labels.intro}</Text>
        )}

        <Text size="xs" c="dimmed">
          {model.learnMore.map((segment, index) =>
            segment.href ? (
              <Anchor key={`${segment.href}-${index}`} component={Link} href={segment.href} size="xs">
                {segment.text}
              </Anchor>
            ) : (
              <span key={`text-${index}`}>{segment.text}</span>
            ),
          )}
        </Text>

        <Group gap="xs">
          <Button
            id="cookie-consent-reject-non-essential"
            size="xs"
            tone="neutral"
            emphasis="medium"
            onClick={onRejectNonEssential}
          >
            {model.labels.rejectNonEssential}
          </Button>
          <Button size="xs" emphasis="medium" onClick={onTogglePreferences}>
            {model.showPreferences ? model.labels.hidePreferences : model.labels.customize}
          </Button>
          <Button size="xs" onClick={onAcceptAll}>
            {model.labels.acceptAll}
          </Button>
        </Group>

        <Collapse expanded={model.showPreferences}>
          <Stack gap="xs" mt="xs">
            <Switch checked disabled label={model.labels.essential} />
            <Switch
              checked={model.analyticsEnabled}
              onChange={(event) => onAnalyticsChange(event.currentTarget.checked)}
              label={model.labels.analytics}
            />
            <Group justify="flex-end" mt="xs">
              <Button size="xs" onClick={onSavePreferences}>
                {model.labels.savePreferences}
              </Button>
            </Group>
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
