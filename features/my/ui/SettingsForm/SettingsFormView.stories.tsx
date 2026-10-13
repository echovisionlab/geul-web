import { useArgs } from 'storybook/preview-api';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { SettingsFormView, type SettingsFormViewLabels } from './SettingsFormView';

const labels: SettingsFormViewLabels = {
  subscribedAlert: 'You are subscribed to our newsletter and campaign emails.',
  unsubscribedAlert: 'You are not subscribed to our newsletter.',
  subscribe: 'Subscribe to newsletter',
  unsubscribe: 'Unsubscribe from emails',
  footer: 'Security alerts and legal notices are always sent regardless of your subscription status.',
  errorTitle: 'Error',
};

const meta: Meta<typeof SettingsFormView> = {
  title: 'Feature/My/SettingsForm',
  component: SettingsFormView,
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    return (
      <SettingsFormView
        {...args}
        events={{ onSubscriptionChange: (subscribed) => updateArgs({ subscribed, error: null }) }}
      />
    );
  },
  parameters: { layout: 'centered' },
  decorators: [
    withFeatureLabels({
      labels: {
        subscribedAlert: 'settings.newsletter.subscribedAlert',
        unsubscribedAlert: 'settings.newsletter.unsubscribedAlert',
        subscribe: 'settings.newsletter.subscribe',
        unsubscribe: 'settings.newsletter.unsubscribe',
        footer: 'settings.newsletter.footer',
        errorTitle: 'common.labels.error',
      },
      project: (args, t) => ({ error: args.error ? t('common.messages.failedToLoad') : args.error }),
    }),
    (Story) => (
      <div style={{ width: 560, maxWidth: '100%', padding: 'var(--geul-spacing-md)' }}>
        <Story />
      </div>
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

export const NarrowViewport: Story = {
  args: { subscribed: false },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
