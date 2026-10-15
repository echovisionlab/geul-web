import { expect, userEvent, waitFor, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import SiteSettingsPage, { type SiteSettingsPageBindings } from '@/features/admin/settings/SiteSettingsPage';
import type { SiteAssetBindings } from '@/features/site/site-asset-bindings';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
function fixture(state: 'ready' | 'failed' | 'pending' | 'action-failed'): SiteSettingsPageBindings {
  let settings = {
    ...DEFAULT_SITE_SETTINGS_VIEW,
    site_title: 'Listening room',
    site_origin: 'https://preview.example.com',
    company_name: 'Studio',
    support_email: 'hello@example.com',
  };
  const files = new Map<string, string>();
  const upload: SiteAssetBindings['upload'] = async (blob) => {
    if (state === 'action-failed') {
      throw new Error('Local upload failed');
    }
    const fileId = `preview-file-${crypto.randomUUID()}`;
    const url = URL.createObjectURL(blob);
    files.set(fileId, url);
    return { fileId, url };
  };
  const asset: SiteAssetBindings = {
    set: async (type, fileId) => {
      if (state === 'action-failed') {
        return { error: 'Local asset update failed' };
      }
      settings = { ...settings, [`${type}_url`]: files.get(fileId) ?? null };
      return { success: true };
    },
    remove: async (type) => {
      if (state === 'action-failed') {
        return { error: 'Local asset removal failed' };
      }
      settings = { ...settings, [`${type}_url`]: null };
      return { success: true };
    },
    upload,
    uploadFile: upload,
  };
  return {
    getSettings: async () => {
      if (state === 'pending') {
        return new Promise(() => {});
      }
      if (state === 'failed') {
        throw new Error('Local settings read failed');
      }
      return settings;
    },
    getPages: async () => ({ ok: true, value: [] }),
    getMenus: async () => [],
    update: async (patch) => {
      if (state === 'action-failed') {
        return { error: 'Local save failed' };
      }
      settings = { ...settings, ...patch };
      return { success: true };
    },
    asset,
    loader: {
      add: async (fileId) => {
        if (state === 'action-failed') {
          return { error: 'Local asset update failed' };
        }
        const url = files.get(fileId);
        if (!url) {
          return { error: 'Local asset missing' };
        }
        settings = {
          ...settings,
          loader_assets: [...settings.loader_assets, { file_id: fileId, url }],
          loader_urls: [...settings.loader_urls, url],
        };
        return { success: true };
      },
      remove: async (fileId) => {
        settings = {
          ...settings,
          loader_assets: settings.loader_assets.filter((asset) => asset.file_id !== fileId),
          loader_urls: settings.loader_urls.filter((url) => url !== files.get(fileId)),
        };
        return { success: true };
      },
      uploadFile: upload,
    },
    og: {
      status: async () => ({ data: { assetId: null } }),
      regenerate: async () => ({ error: 'Image generation is unavailable in this preview' }),
      read: {
        latest: async () => actionSuccess({ generation: undefined }),
        generation: async () => actionFailure('No local generation', 'OG_GENERATION_NOT_FOUND'),
      },
      asset,
    },
  };
}
function Preview({ state = 'ready' }: { state?: Parameters<typeof fixture>[0] }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [bindings] = useState(() => fixture(state));
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <SiteSettingsPage bindings={bindings} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Site Settings',
  component: Preview,
  args: { state: 'ready' },
  render: (args) => <Preview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Complete production site settings controller and form including logo/favicon/loader/OG branding owners. Typed local reads and saves; actual upload storage, image generation, authorization and persistence are outside. Selected upload bytes, loader entries and removal update local assets. Service-backed OG generation is omitted.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Failed: Story = { args: { state: 'failed' } };
export const Pending: Story = { args: { state: 'pending' } };
export const ActionFailed: Story = { args: { state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardSettingsSave: Story = {
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const form = await canvas.findByRole('form', { name: t.site('title') });
    const title = within(form).getByRole('textbox', { name: t.site('fields.siteTitle.label') });
    const save = within(form).getByRole('button', { name: t.common('actions.saveChanges') });
    await expect(save).toBeDisabled();
    await userEvent.clear(title);
    await userEvent.type(title, 'Listening room · Studio');
    await expect(save).toBeEnabled();
    save.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(save).toBeDisabled());
    await expect(title).toHaveValue('Listening room · Studio');
    await expect(form).toHaveAttribute('aria-busy', 'false');
  },
};
