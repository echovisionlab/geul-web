import type { Meta, StoryObj } from '@storybook/nextjs';
import { useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
import { SiteOgImagePanel, type SiteOgImageBindings } from './SiteOgImagePanel';

function SiteOgPreview({ state }: { state: 'pending' | 'ready' | 'empty' | 'error' }) {
  const client = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    [state],
  );
  useEffect(() => () => client.clear(), [client]);
  const bindings: SiteOgImageBindings = {
    status: async () => {
      if (state === 'pending') {
        return new Promise<never>(() => {});
      }
      if (state === 'error') {
        return actionFailure('Could not load the Site OG status.', 'ACTION_FAILED');
      }
      return actionSuccess({
        data: {
          assetId: state === 'ready' ? 'preview' : null,
          url: state === 'ready' ? '/storybook/media/video-poster.jpg' : undefined,
        },
      });
    },
    regenerate: async () => ({ error: 'Generation is unavailable in this preview.' }),
    read: {
      latest: async () => actionSuccess({ generation: undefined }),
      generation: async () => actionFailure('No generation exists in this preview.', 'OG_GENERATION_NOT_FOUND'),
    },
    asset: {
      set: async () => actionFailure('Uploads are unavailable in this preview.', 'ACTION_FAILED'),
      remove: async () => actionFailure('Removal is unavailable in this preview.', 'ACTION_FAILED'),
      upload: async () => {
        throw new Error('Uploads are unavailable in this preview.');
      },
      uploadFile: async () => {
        throw new Error('Uploads are unavailable in this preview.');
      },
    },
  };
  return (
    <QueryClientProvider client={client}>
      <SiteOgImagePanel currentBackgroundUrl={null} bindings={bindings} />
    </QueryClientProvider>
  );
}
const meta: Meta<typeof SiteOgPreview> = {
  title: 'Feature/Site/OG Image Query',
  component: SiteOgPreview,
  parameters: { nextjs: { appDirectory: true } },
  args: { state: 'ready' },
};
export default meta;
type Story = StoryObj<typeof SiteOgPreview>;
export const Default: Story = {};
export const Pending: Story = { args: { state: 'pending' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'error' } };
