import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import AdminDashboardPage from '@/features/admin/dashboard/AdminDashboardPage';
function DashboardPreview({ state = 'ready' }: { state?: 'ready' | 'empty' | 'failed' | 'pending' }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <AdminDashboardPage
          loadStats={async () => {
            if (state === 'pending') {
              return new Promise(() => {});
            }
            if (state === 'failed') {
              throw new Error('Dashboard unavailable');
            }
            return state === 'empty'
              ? { totalUsers: 0, totalPosts: 0, totalPages: 0, totalComments: 0 }
              : { totalUsers: 124, totalPosts: 36, totalPages: 12, totalComments: 87 };
          }}
        />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Dashboard',
  component: DashboardPreview,
  args: { state: 'ready' },
  render: (args) => <DashboardPreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual dashboard controller and Core StatCards with a local stats reader. Error, loading, empty and populated states; permissions and live counts are outside.',
      },
    },
  },
} satisfies Meta<typeof DashboardPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Pending: Story = { args: { state: 'pending' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
