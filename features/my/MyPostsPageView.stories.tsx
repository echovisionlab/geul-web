import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MyPostsPageView } from './MyPostsPageView';
const meta = {
  title: 'Feature/My/Posts',
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual personal posts view with a local query client. Loading stays unresolved; Failed rejects the list request and offers the production query retry UI. No post list is fetched.',
      },
    },
  },
  component: MyPostsPageView,
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof MyPostsPageView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = { args: { listAction: () => new Promise<never>(() => {}) } };
export const Failed: Story = {
  args: {
    listAction: async () => {
      throw new Error('Offline fixture');
    },
  },
};
