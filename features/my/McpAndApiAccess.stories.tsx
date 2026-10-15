import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Heading as DsHeading } from '@/components/core/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';

import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { usePersonalAccessTokenLabels } from './usePersonalAccessTokenLabels';
import { useTranslations } from 'next-intl';
import { McpIntegrationSettingsView } from './ui/McpIntegrationSettings';
import { PersonalAccessTokenSettingsView } from './ui/PersonalAccessTokenSettings';
import { useState } from 'react';
import type {
  PersonalAccessTokenViewModel,
  PersonalAccessTokenSecretViewModel,
} from './ui/PersonalAccessTokenSettings/PersonalAccessTokenSettingsView';

function McpAndApiAccessContent({ showSecret = false }: { showSecret?: boolean }) {
  const labels = usePersonalAccessTokenLabels();
  const t = useTranslations();
  const [secret, setSecret] = useState<PersonalAccessTokenSecretViewModel | null>(
    showSecret ? { value: 'storybook-example-only-not-a-credential' } : null,
  );
  const [token, setToken] = useState<PersonalAccessTokenViewModel | null>(
    showSecret ? { id: 'local-preview', createdAtLabel: '2026-10-11', canRegenerate: true } : null,
  );
  const createToken = async () => {
    setToken({ id: crypto.randomUUID(), createdAtLabel: '2026-10-11', canRegenerate: true });
    setSecret({ value: `storybook-example-only-${crypto.randomUUID()}` });
    return true;
  };
  return (
    <>
      <div
        style={{
          width: 760,
          maxWidth: '100%',
          marginInline: 'auto',
          paddingBlock: 'var(--geul-spacing-xl)',
        }}
      >
        <DsLayoutStack gap="xl">
          <DsHeading level={2}>{t('common.labels.settings')}</DsHeading>

          <PersonalAccessTokenSettingsView
            token={token}
            labels={labels}
            secret={secret}
            onCreate={createToken}
            onRegenerate={createToken}
            onDelete={async () => {
              setToken(null);
              setSecret(null);
              return true;
            }}
            onCopySecret={(value) => void navigator.clipboard.writeText(value)}
            onCloseSecret={() => setSecret(null)}
          />

          <McpIntegrationSettingsView
            endpoint="https://site.example.invalid/mcp"
            setupGuideUrl="/fixtures/remote-mcp-preview.md"
            labels={{
              title: 'Remote MCP',
              description: t('security.mcpIntegration.description'),
              endpoint: t('common.labels.url'),
              openGuide: t('common.actions.openInNewTab'),
            }}
          />
        </DsLayoutStack>
      </div>
    </>
  );
}

function McpAndApiAccessPreview({
  siteName = 'Rawsector',
  showSecret = false,
}: {
  siteName?: string;
  showSecret?: boolean;
}) {
  return (
    <ManifestProvider
      manifest={{
        settings: {
          ...DEFAULT_SITE_SETTINGS_VIEW,
          site_title: siteName,
          favicon_asset_set: null,
          site_og_image_url: null,
        },
        menus: { $typeName: 'api.open.v1.Menus', header: [], secondary: [], footer: [], avatarDropdown: [] },
      }}
    >
      <McpAndApiAccessContent showSecret={showSecret} />
    </ManifestProvider>
  );
}

const meta = {
  title: 'Feature/My/MCP and API Access',
  component: McpAndApiAccessPreview,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The endpoint remains a named term/definition pair for screen readers. Its URL label is visually hidden because the displayed address identifies the value. The full endpoint and guide destination are preserved.',
      },
    },
  },
  args: { siteName: 'Rawsector' },
  argTypes: { siteName: { control: 'text' } },
} satisfies Meta<typeof McpAndApiAccessPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthorOrAdmin: Story = {
  play: async ({ canvasElement }) => {
    const section = canvasElement.querySelector<HTMLElement>('[data-testid="settings-mcp-integration"]')!;
    const endpoint = within(section).getByRole('definition');
    await expect(endpoint).toHaveAccessibleName();
    await expect(endpoint).toHaveTextContent('https://site.example.invalid/mcp');
    const label = section.querySelector<HTMLElement>('[role="term"] > span')!;
    await expect(label.textContent?.trim()).toBeTruthy();
    await expect(getComputedStyle(label).position).toBe('absolute');
    await expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await expect(label.getBoundingClientRect().height).toBeLessThanOrEqual(1);
  },
};

export const CustomSiteName: Story = { args: { siteName: 'Example Studio' } };
export const OneTimeValue: Story = { args: { showSecret: true } };

export const NarrowViewport: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
};
