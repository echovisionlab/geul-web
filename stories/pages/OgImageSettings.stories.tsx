import { expect, userEvent, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import OgImageSettingsPage, { type OgImageSettingsPageBindings } from '@/features/admin/settings/OgImageSettingsPage';
import { DEFAULT_CONTENT_OG_CONFIG, DEFAULT_HOME_OG_CONFIG } from '@/lib/utils/og-config';
import { actionFailure } from '@/lib/actions/action-result';
import { Code } from '@connectrpc/connect';
function fixture(state: 'ready' | 'empty' | 'failed' | 'pending' | 'action-failed'): OgImageSettingsPageBindings {
  let config = { home: structuredClone(DEFAULT_HOME_OG_CONFIG), content: structuredClone(DEFAULT_CONTENT_OG_CONFIG) };
  return {
    getOgConfig: async () => {
      if (state === 'pending') {
        return new Promise(() => {});
      }
      if (state === 'failed') {
        throw new Error('Local OG settings lookup failed');
      }
      return state === 'empty' ? null : config;
    },
    updateHomeOgConfigAction: async (home) => {
      if (state === 'action-failed') {
        return { error: 'Local save failed' };
      }
      config = { ...config, home };
      return { success: true };
    },
    updateContentOgConfigAction: async (content) => {
      if (state === 'action-failed') {
        return { error: 'Local save failed' };
      }
      config = { ...config, content };
      return { success: true };
    },
    regenerateAllOgImagesAction: async () => ({ error: 'Image generation requires the unavailable preview service' }),
    getOgGenerationRunAction: async () =>
      actionFailure('Image generation is unavailable in this preview', Code.Unimplemented),
  };
}
export function OgImageSettingsPreview({ state = 'ready' }: { state?: Parameters<typeof fixture>[0] }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [bindings] = useState(() => fixture(state));
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <OgImageSettingsPage bindings={bindings} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/OG Image Settings',
  excludeStories: ['OgImageSettingsPreview'],
  component: OgImageSettingsPreview,
  args: { state: 'ready' },
  render: (args) => <OgImageSettingsPreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual complete production OG settings controller, both home/content panels, local config save and resets. Service generation and live renderer panels are omitted by the Storybook availability provider.',
      },
    },
  },
} satisfies Meta<typeof OgImageSettingsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Defaults: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Pending: Story = { args: { state: 'pending' } };
export const ActionFailed: Story = { args: { state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardContentValues: Story = {
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const tab = await canvas.findByRole('tab', { name: t.og('tabs.content') });
    tab.focus();
    await userEvent.keyboard('{Enter}');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const form = canvas.getByRole('form', { name: `${t.og('title')} ${t.og('tabs.content')}` });
    const slider = within(form).getByRole('slider', { name: t.og('content.fields.fontSizeThreshold') });
    const before = Number((slider as HTMLInputElement).value);
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(slider).toHaveValue(String(before + 1));
    await expect(within(form).getByRole('slider', { name: t.common('labels.lineHeight') })).toHaveAttribute('min', '1');
    await expect(within(form).getByRole('slider', { name: t.common('labels.opacity') })).toHaveAttribute('max', '1');
  },
};
