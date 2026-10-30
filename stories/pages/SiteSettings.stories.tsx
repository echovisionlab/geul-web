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
    contact_email: 'contact@example.com',
    legal_email: 'legal@example.com',
    // Published brand assets; the remaining slots show their empty upload state.
    logo_full_light_url: 'https://cdn.rawsector.com/asset/b8cc8296-7f93-4704-b06d-657d39171ba9/image.svg',
    logo_full_dark_url: 'https://cdn.rawsector.com/asset/62d7d08d-8a4e-4ff7-96a2-a7669a0183bc/image.svg',
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
        return actionFailure('Local asset update failed', 'ACTION_FAILED');
      }
      settings = { ...settings, [`${type}_url`]: files.get(fileId) ?? null };
      return actionSuccess({ success: true as const });
    },
    remove: async (type) => {
      if (state === 'action-failed') {
        return actionFailure('Local asset removal failed', 'ACTION_FAILED');
      }
      settings = { ...settings, [`${type}_url`]: null };
      return actionSuccess({ success: true as const, assetUrl: null });
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
        return actionFailure('Local save failed', 'ACTION_FAILED');
      }
      settings = { ...settings, ...patch };
      return actionSuccess({ success: true as const });
    },
    asset,
    loader: {
      add: async (fileId) => {
        if (state === 'action-failed') {
          return actionFailure('Local asset update failed', 'ACTION_FAILED');
        }
        const url = files.get(fileId);
        if (!url) {
          return actionFailure('Local asset missing', 'ACTION_FAILED');
        }
        settings = {
          ...settings,
          loader_assets: [...settings.loader_assets, { file_id: fileId, url }],
          loader_urls: [...settings.loader_urls, url],
        };
        return actionSuccess({ success: true as const });
      },
      remove: async (fileId) => {
        settings = {
          ...settings,
          loader_assets: settings.loader_assets.filter((asset) => asset.file_id !== fileId),
          loader_urls: settings.loader_urls.filter((url) => url !== files.get(fileId)),
        };
        return actionSuccess({ success: true as const });
      },
      uploadFile: upload,
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
          'Complete production site settings controller and form including the full, symbol and email logos, favicon and loader owners. Typed local reads and saves; actual upload storage, image generation, authorization and persistence are outside. Selected upload bytes, loader entries and removal update local assets. Sharing images live on the OG Image Settings page.',
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
    const contact = within(form).getByRole('textbox', { name: t.site('fields.contactEmail.label') });
    const legal = within(form).getByRole('textbox', { name: t.site('fields.legalEmail.label') });
    await expect(contact).toHaveValue('contact@example.com');
    await expect(legal).toHaveValue('legal@example.com');
    await expect(form.querySelectorAll('input[inputmode="email"]')).toHaveLength(2);
    await expect(form.querySelector('[name="support_contact_email"]')).toBeNull();
    await expect(form.querySelector('[name="privacy_contact_email"]')).toBeNull();
    const save = within(form).getByRole('button', { name: t.common('actions.saveChanges') });
    await expect(save).toBeDisabled();
    await userEvent.clear(title);
    await userEvent.type(title, 'Listening room · Studio');
    await userEvent.clear(contact);
    await userEvent.type(contact, 'hello@example.com');
    await expect(save).toBeEnabled();
    save.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(save).toBeDisabled());
    await expect(title).toHaveValue('Listening room · Studio');
    await expect(contact).toHaveValue('hello@example.com');
    await expect(legal).toHaveValue('legal@example.com');
    await expect(form).toHaveAttribute('aria-busy', 'false');
  },
};
