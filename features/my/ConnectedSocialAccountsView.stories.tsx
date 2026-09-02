import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box } from '@mantine/core';
import { AccountEmailProviderLogo } from '@/features/account-email/AccountEmailOption';
import { ConnectedSocialAccountsView } from './ui/ConnectedSocialAccounts';

const meta = {
  title: 'Feature/My/Connected Social Logins',
  component: ConnectedSocialAccountsView,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={560} maw="calc(100vw - 2rem)">
        <Story />
      </Box>
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
    providerIcon: (provider) => <AccountEmailProviderLogo provider={provider} size={provider === 'google' ? 18 : 16} />,
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
