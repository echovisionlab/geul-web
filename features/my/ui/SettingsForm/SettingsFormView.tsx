'use client';

import { IconMail, IconMailOff } from '@tabler/icons-react';
import { Stack, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';

export interface SettingsFormViewLabels {
  subscribedAlert: string;
  unsubscribedAlert: string;
  subscribe: string;
  unsubscribe: string;
  footer: string;
  errorTitle: string;
}

export interface SettingsFormViewEvents {
  onSubscriptionChange: (subscribed: boolean) => void;
}

export interface SettingsFormViewProps {
  subscribed: boolean;
  labels: SettingsFormViewLabels;
  events: SettingsFormViewEvents;
  pending?: boolean;
  disabled?: boolean;
  error?: string | null;
}

/** Pure newsletter settings view. Copy, state, and commands arrive through props. */
export function SettingsFormView({
  subscribed,
  labels,
  events,
  pending = false,
  disabled = false,
  error = null,
}: SettingsFormViewProps) {
  const StatusIcon = subscribed ? IconMail : IconMailOff;

  return (
    <Stack gap="lg" data-subscription-state={subscribed ? 'subscribed' : 'unsubscribed'}>
      <Alert
        icon={<StatusIcon size={16} aria-hidden />}
        tone={subscribed ? 'positive' : 'neutral'}
        role="status"
        aria-live="polite"
      >
        {subscribed ? labels.subscribedAlert : labels.unsubscribedAlert}
      </Alert>

      {error ? (
        <Alert tone="danger" title={labels.errorTitle} role="alert">
          {error}
        </Alert>
      ) : null}

      <Button
        type="button"
        tone={subscribed ? 'neutral' : 'accent'}
        emphasis={subscribed ? 'medium' : 'strong'}
        leftSection={subscribed ? <IconMailOff size={16} aria-hidden /> : <IconMail size={16} aria-hidden />}
        onClick={() => events.onSubscriptionChange(!subscribed)}
        loading={pending}
        disabled={disabled}
        styles={{
          root: { height: 'auto', minHeight: 'var(--button-height)', paddingBlock: 8 },
          label: { whiteSpace: 'normal', overflow: 'visible', lineHeight: 1.35, textAlign: 'center' },
        }}
      >
        {subscribed ? labels.unsubscribe : labels.subscribe}
      </Button>

      <Text size="sm" c="dimmed">
        {labels.footer}
      </Text>
    </Stack>
  );
}
