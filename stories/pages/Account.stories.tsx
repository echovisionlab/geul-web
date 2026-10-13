import type { Meta, StoryObj } from '@storybook/nextjs';
import { AccountPreview } from '../shared/AccountPreview';
import { previewStateControl } from '../shared/PreviewFrame';
const meta = {
  parameters: {
    canvasInset: 'none',
    docs: {
      description: {
        component:
          'Account panel composition. Full production page contracts are documented in Pages/Account/Full Pages.',
      },
    },
  },
  title: 'Pages/Account/Settings',
  component: AccountPreview,
  args: { state: 'ready', initialTab: 'profile' },
  argTypes: {
    state: previewStateControl,
    initialTab: {
      control: 'select',
      options: ['profile', 'security', 'newsletter'],
      description: 'Initial panel when the story mounts; switch panels using the tabs.',
    },
  },
  render: (args) => <AccountPreview key={args.initialTab} {...args} />,
} satisfies Meta<typeof AccountPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Profile: Story = {};
export const Security: Story = { args: { initialTab: 'security' } };
export const EmailPreferences: Story = { args: { initialTab: 'newsletter' } };
export const Pending: Story = { args: { state: 'pending' } };
export const Error: Story = { args: { state: 'error' } };
export const Disabled: Story = { args: { state: 'disabled' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
