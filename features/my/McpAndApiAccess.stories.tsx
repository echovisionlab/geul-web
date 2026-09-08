import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box, Divider, Stack, Title } from '@mantine/core';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { usePersonalAccessTokenLabels } from './usePersonalAccessTokenLabels';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { McpOAuthGrantSettings } from './McpOAuthGrantSettings';
import { McpIntegrationSettingsView } from './ui/McpIntegrationSettings';
import { PersonalAccessTokenSettingsView } from './ui/PersonalAccessTokenSettings';

function McpAndApiAccessContent() {
  const labels = usePersonalAccessTokenLabels();
  return (
    <LocaleProvider locale="ko">
      <Box w={760} maw="calc(100vw - 2rem)" mx="auto" py="xl">
        <Stack gap="lg">
          <Title order={2}>설정</Title>

          <PersonalAccessTokenSettingsView
            token={null}
            labels={labels}
            onCreate={async () => false}
            onRegenerate={async () => false}
            onDelete={async () => false}
            onCopySecret={() => {}}
            onCloseSecret={() => {}}
          />

          <Divider />

          <McpIntegrationSettingsView
            endpoint="https://site.example.invalid/mcp"
            setupGuideUrl="https://site.example.invalid/guides/remote-mcp.md"
            labels={{
              title: 'Remote MCP',
              description:
                '호환되는 AI 클라이언트에 이 엔드포인트를 연결하세요. 로그인과 동의를 위해 브라우저가 열립니다.',
              endpoint: 'URL',
              openGuide: '설치 가이드 열기',
            }}
          />

          <McpOAuthGrantSettings
            initialGrants={[
              { id: 'codex-desktop', clientName: 'Codex', connectedAt: '2026-08-27T10:25:00Z' },
              { id: 'chatgpt', clientName: 'ChatGPT', connectedAt: '2026-08-26T06:10:00Z' },
            ]}
          />
        </Stack>
      </Box>
    </LocaleProvider>
  );
}

function McpAndApiAccessPreview({ siteName = 'DSUB' }: { siteName?: string }) {
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
      <McpAndApiAccessContent />
    </ManifestProvider>
  );
}

const meta = {
  title: 'Feature/My/MCP and API Access',
  component: McpAndApiAccessPreview,
  parameters: { layout: 'fullscreen' },
  globals: { locale: 'ko' },
  args: { siteName: 'DSUB' },
  argTypes: { siteName: { control: 'text' } },
} satisfies Meta<typeof McpAndApiAccessPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthorOrAdmin: Story = {};

export const CustomSiteName: Story = { args: { siteName: 'Example Studio' } };

export const NarrowViewport: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
