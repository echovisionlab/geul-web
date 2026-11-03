import type { Meta, StoryObj } from '@storybook/nextjs';
import { McpConsentPageView } from './McpConsentPageView';
const meta = {
  title: 'Feature/Auth/MCP Consent',
  parameters: {
    docs: {
      description: {
        component:
          'Actual consent view. PendingDecision waits indefinitely after either decision is selected so both forms can be inspected while locked. No consent is sent to a server.',
      },
    },
  },
  component: McpConsentPageView,
  args: {
    clientName: 'Local preview client',
    delegationName: 'Preview account',
    offlineAccess: true,
    description: 'Connect using your account permissions.',
    offlineDescription: 'The client can retain access.',
    revokeDescription: 'Revoke access from account settings.',
    cancelLabel: 'Cancel',
    connectLabel: 'Connect',
    approveAction: async () => {},
    rejectAction: async () => {},
  },
} satisfies Meta<typeof McpConsentPageView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const PendingDecision: Story = {
  args: { approveAction: () => new Promise(() => {}), rejectAction: () => new Promise(() => {}) },
};
