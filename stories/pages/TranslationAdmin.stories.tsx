import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import { TranslationOverviewPage } from '@/features/translation/admin/TranslationOverviewPage';
import { TranslationSettingsPage } from '@/features/translation/admin/TranslationSettingsPage';
import { translationAdminFixture, type TranslationPreviewState } from './fixtures/translation-admin';
export function TranslationAdminPreview({
  surface = 'overview',
  state = 'ready',
}: {
  surface?: 'overview' | 'settings';
  state?: TranslationPreviewState;
}) {
  const [client] = useState(() => translationAdminFixture(state));
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <LayoutContainer size="wide" inset="md">
        {surface === 'overview' ? (
          <TranslationOverviewPage client={client} />
        ) : (
          <TranslationSettingsPage client={client} />
        )}
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Translation',
  excludeStories: ['TranslationAdminPreview'],
  component: TranslationAdminPreview,
  args: { surface: 'overview', state: 'ready' },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/translations', query: {} } },
    docs: {
      description: {
        component:
          'Actual production overview and settings controllers with typed in-memory RPC responses. Refresh and dirty settings save use local state. Authentication, backend CAS and route navigation remain outside.',
      },
    },
  },
  decorators: [(Story, context) => <Story key={`${context.args.surface}:${context.args.state}`} />],
} satisfies Meta<typeof TranslationAdminPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const OverviewEmpty: Story = { args: { state: 'empty' } };
export const OverviewFailed: Story = { args: { state: 'error' } };
export const OverviewPending: Story = { args: { state: 'pending' } };
export const Settings: Story = { args: { surface: 'settings' } };
export const SettingsEmpty: Story = { args: { surface: 'settings', state: 'empty' } };
export const SettingsFailed: Story = { args: { surface: 'settings', state: 'error' } };
export const SettingsPending: Story = { args: { surface: 'settings', state: 'pending' } };
export const SaveFailed: Story = { args: { surface: 'settings', state: 'save-error' } };
export const Phone: Story = {
  args: { surface: 'settings' },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
