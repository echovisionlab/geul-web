import type { Meta, StoryObj } from '@storybook/nextjs';
import { LoginErrorPageView } from '@/features/auth/LoginErrorPageView';
const meta = {
  title: 'Pages/Auth/Login Error',
  component: LoginErrorPageView,
  args: { error: null },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The exact login/error production view. Local identity-error fixtures drive the production status and recovery-action branches. UI copy follows toolbar locale; no identity-server authentication or account action is performed.',
      },
    },
  },
} satisfies Meta<typeof LoginErrorPageView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Generic: Story = {};
export const PendingDeletion: Story = { args: { error: { id: 'account_pending_deletion' } } };
export const Suspended: Story = { args: { error: { id: 'account_banned' } } };
export const SessionInactive: Story = { args: { error: { id: 'session_inactive' } } };
export const SecurityViolation: Story = { args: { error: { id: 'security_csrf_violation' } } };
export const UnknownError: Story = { args: { error: { id: 'unknown', code: 502 } } };
