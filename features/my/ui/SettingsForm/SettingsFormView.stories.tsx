import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box } from '@mantine/core';

import { SettingsFormView, type SettingsFormViewLabels } from './SettingsFormView';

const labels: SettingsFormViewLabels = {
  subscribedAlert: 'You are subscribed to our newsletter and campaign emails.',
  unsubscribedAlert: 'You are not subscribed to our newsletter.',
  subscribe: 'Subscribe to newsletter',
  unsubscribe: 'Unsubscribe from emails',
  footer: 'Security alerts and legal notices are always sent regardless of your subscription status.',
  errorTitle: 'Error',
};

const longLocaleLabels: SettingsFormViewLabels = {
  subscribedAlert: 'Sie haben unseren Newsletter und unsere E-Mails zu aktuellen Kampagnen abonniert.',
  unsubscribedAlert: 'Sie haben unseren Newsletter und unsere E-Mails zu aktuellen Kampagnen nicht abonniert.',
  subscribe: 'Newsletter und Kampagnenmitteilungen abonnieren',
  unsubscribe: 'Newsletter und Kampagnenmitteilungen abbestellen',
  footer:
    'Sicherheitswarnungen, Mitteilungen zum Zurücksetzen des Passworts und rechtliche Hinweise werden unabhängig von Ihrem Abonnementstatus immer gesendet.',
  errorTitle: 'Die Einstellung konnte nicht gespeichert werden',
};

const meta: Meta<typeof SettingsFormView> = {
  title: 'Feature/My/SettingsForm',
  component: SettingsFormView,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={560} maw="calc(100vw - 2rem)" p="md">
        <Story />
      </Box>
    ),
  ],
  args: {
    subscribed: true,
    pending: false,
    disabled: false,
    error: null,
    labels,
    events: { onSubscriptionChange: () => {} },
  },
};

export default meta;
type Story = StoryObj<typeof SettingsFormView>;

export const Subscribed: Story = {};

export const Unsubscribed: Story = {
  args: { subscribed: false },
};

export const SavingSubscription: Story = {
  args: { subscribed: false, pending: true },
};

export const SavingUnsubscription: Story = {
  args: { subscribed: true, pending: true },
};

export const Error: Story = {
  args: {
    subscribed: false,
    error: 'The newsletter service did not accept this request. Please try again.',
  },
};

export const LongLocale: Story = {
  args: { labels: longLocaleLabels },
};

export const NarrowViewport: Story = {
  args: { subscribed: false, labels: longLocaleLabels },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
