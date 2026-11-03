import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { FormPasswordContent } from './FormPasswordContent';
const meta = {
  title: 'Feature/Form/Password Preparation',
  component: FormPasswordContent,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  args: {
    slug: 'password-preview',
    requestedLocale: 'en',
    accessAction: () => new Promise(() => {}),
    onNavigate: () => {},
  },
} satisfies Meta<typeof FormPasswordContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AccessPreparation: Story = {};
