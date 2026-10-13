import { useArgs } from 'storybook/preview-api';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { AccountEmailProviderLogo } from '@/features/account-email/AccountEmailOption';
import { ConnectedSocialAccountsView } from './ui/ConnectedSocialAccounts';

const meta = {
  title: 'Feature/My/Connected Social Logins',
  component: ConnectedSocialAccountsView,
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    return (
      <ConnectedSocialAccountsView
        {...args}
        onLink={(provider) =>
          updateArgs({
            connectedProviders: [...args.connectedProviders, provider],
            availableProviders: args.availableProviders.filter((value) => value !== provider),
          })
        }
        onUnlink={(provider) =>
          updateArgs({
            connectedProviders: args.connectedProviders.filter((value) => value !== provider),
            availableProviders: [...args.availableProviders, provider],
          })
        }
      />
    );
  },
  parameters: { layout: 'centered' },
  decorators: [
    withFeatureLabels({
      labels: {
        connect: 'common.actions.connect',
        connected: 'common.states.connected',
        description: 'security.connectedAccounts.description',
        disconnect: 'common.actions.disconnect',
        lastMethod: 'security.providerErrors.mustKeepMethod',
        notConnected: 'common.states.notConnected',
        primaryEmailRequired: 'security.providerErrors.primaryEmailRequired',
        title: 'security.connectedAccounts.title',
      },
    }),
    (Story) => (
      <div style={{ width: 560, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    availableProviders: ['github'],
    connectedProviders: ['google'],
    labels: {
      connect: 'Connect',
      connected: 'Connected',
      description: 'Manage providers that can sign in to this account.',
      disconnect: 'Disconnect',
      lastMethod: 'Keep at least one sign-in method.',
      notConnected: 'Not connected',
      primaryEmailRequired: 'This provider supplies the primary email.',
      providerName: (provider) => (provider === 'google' ? 'Google' : 'GitHub'),
      title: 'Connected accounts',
    },
    linkingProvider: null,
    onLink: () => {},
    onUnlink: () => {},
    providerIcon: (provider) => <AccountEmailProviderLogo provider={provider} />,
    unlinkBlockedReasons: {},
    unlinkingProvider: null,
  },
} satisfies Meta<typeof ConnectedSocialAccountsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ConnectedAndAvailable: Story = {};
export const LastSignInMethodIsProtected: Story = { args: { unlinkBlockedReasons: { google: 'last_method' } } };
export const PrimaryEmailSourceIsProtected: Story = { args: { unlinkBlockedReasons: { google: 'primary_email' } } };
export const Linking: Story = { args: { linkingProvider: 'github' } };
export const Unlinking: Story = { args: { unlinkingProvider: 'google' } };
