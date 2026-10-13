import { navigatePreview } from '@/stories/shared/preview-navigation';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { AccountEmailSettingsView } from './ui/AccountEmailSettings';

const meta = {
  title: 'Feature/My/Primary Email Settings',
  component: AccountEmailSettingsView,
  render: (args) => (
    <AccountEmailSettingsView
      {...args}
      onChangeEmail={() => navigatePreview('/?path=/story/feature-auth-verification-flow-view--choose-email')}
    />
  ),
  parameters: { layout: 'centered' },
  decorators: [
    withFeatureLabels({
      labels: {
        canonical: 'security.email.canonical',
        change: 'security.email.changeAction',
        description: 'security.email.description',
        emailCode: 'security.email.sources.emailCode',
        title: 'security.email.title',
      },
    }),
    (Story) => (
      <div style={{ width: 680, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    email: 'studio@example.invalid',
    emailCodeAvailable: true,
    labels: {
      canonical: 'Primary email',
      change: 'Change',
      description: 'Choose the address used for account messages.',
      emailCode: 'Email code',
      title: 'Account email',
    },
    onChangeEmail: () => {},
  },
} satisfies Meta<typeof AccountEmailSettingsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CanonicalEmail: Story = {};
export const PendingVerification: Story = { args: { emailCodeAvailable: false } };

export const NarrowViewport: Story = {
  args: { email: 'studio.long-account-name@example.invalid' },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
