import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box } from '@mantine/core';
import { AccountEmailSettingsView } from './ui/AccountEmailSettings';

const meta = {
  title: 'Feature/My/Primary Email Settings',
  component: AccountEmailSettingsView,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={680} maw="calc(100vw - 2rem)">
        <Story />
      </Box>
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
