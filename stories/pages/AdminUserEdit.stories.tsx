import { useState } from 'react';
import { navigatePreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import AdminUserEditPage from '@/features/admin/user/AdminUserEditPage';
import { createLocalTokenBindings } from './fixtures/personal-access-tokens';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import { adminUserFixture } from './fixtures/admin-user';
const checkNickname = async () => ({ available: true });
export function AdminUserEditPreview({ state = 'ready' }: { state?: Parameters<typeof adminUserFixture>[0] }) {
  const [tokenBindings] = useState(() => createLocalTokenBindings(state === 'failed' || state === 'action-failed'));
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [bindings] = useState(() => adminUserFixture(state));
  return (
    <QueryClientProvider client={client}>
      <SessionProvider initialData={null}>
        <LayoutContainer size="wide" inset="md">
          <AdminUserEditPage
            checkNickname={checkNickname}
            tokenBindings={tokenBindings}
            id="local-member"
            bindings={bindings}
            navigate={navigatePreview}
          />
        </LayoutContainer>
      </SessionProvider>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/User Edit',
  excludeStories: ['AdminUserEditPreview'],
  component: AdminUserEditPreview,
  args: { state: 'ready' },
  render: (args) => <AdminUserEditPreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual production member detail controller and profile/auth/security sections with typed local read and mutation transport. Ready/banned/loading/query failure/action error states. Credential-token issuance, SSO continuation, permissions and server identity invariants remain outside; no real account is changed.',
      },
    },
  },
} satisfies Meta<typeof AdminUserEditPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Banned: Story = { args: { state: 'banned' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Pending: Story = { args: { state: 'pending' } };
export const ActionFailed: Story = { args: { state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
