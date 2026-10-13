import type { Meta, StoryObj } from '@storybook/nextjs';
import { navigatePreview } from '../shared/preview-navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from '@/components/core/Alert';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import type { getClient } from '@/lib/queries/client-browser';
import { ClientDetailPageView } from '@/features/admin/client/ClientDetailPageView';
const initial: NonNullable<Awaited<ReturnType<typeof getClient>>> = {
  id: 'client-preview',
  name: 'Quiet Signal',
  website: 'https://example.com',
  logoUrl: null,
  logoLightUrl: null,
  logoDarkUrl: null,
  createdAt: new Date('2026-09-12T10:00:00Z'),
};
export function ClientEditorPreview({ state = 'edit' }: { state?: 'edit' | 'new' | 'pending' | 'save-failed' }) {
  const t = useTranslations('common');
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  const [record] = useState(() => ({ current: initial }));
  const [complete, setComplete] = useState(false);
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide">
        <LayoutStack gap="md">
          {complete && <Alert tone="positive">{t('actions.save')}</Alert>}
          <ClientDetailPageView
            clientId={state === 'new' ? 'new' : initial.id}
            readAction={async () => (state === 'pending' ? new Promise(() => {}) : record.current)}
            createAction={async (name, website) => {
              record.current = { ...record.current, name, website: website ?? null };
              return { data: { id: initial.id } };
            }}
            updateAction={async (_id, data) => {
              if (state === 'save-failed') {
                return { error: t('messages.failedToLoad') };
              }
              record.current = { ...record.current, ...data };
              setComplete(true);
              return { success: true };
            }}
            onNavigate={navigatePreview}
            logoBindings={{
              uploadAction: async (data, mimeType) => ({
                url: URL.createObjectURL(new Blob([data], { type: mimeType })),
              }),
              deleteAction: async () => ({ success: true }),
            }}
          />
        </LayoutStack>
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Client Editor',
  excludeStories: ['ClientEditorPreview'],
  component: ClientEditorPreview,
  args: { state: 'edit' },
  render: (args) => <ClientEditorPreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/admin/clients/client-preview', segments: [['id', 'client-preview']] },
    },
    docs: {
      description: {
        component:
          'Actual ClientDetailPageView extracted from the production client route without changing its form/baseline/query/mutation logic. Local typed reads/create/update, production light/dark logo upload/crop controls with object-URL upload/delete callbacks, and mapped story navigation. New/edit/pending/save-failed states. Actual multipart bytes, asset linking, permission/server validation and persistence outside.',
      },
    },
  },
} satisfies Meta<typeof ClientEditorPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Edit: Story = {};
export const New: Story = { args: { state: 'new' } };
export const Pending: Story = { args: { state: 'pending' } };
export const SaveFailed: Story = { args: { state: 'save-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
