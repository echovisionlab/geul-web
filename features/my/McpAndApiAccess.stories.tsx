import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box, Divider, Stack, Title } from '@mantine/core';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { McpOAuthGrantSettings } from './McpOAuthGrantSettings';
import { McpIntegrationSettingsView } from './ui/McpIntegrationSettings';
import { PersonalAccessTokenSettingsView } from './ui/PersonalAccessTokenSettings';

function McpAndApiAccessPreview() {
  return (
    <LocaleProvider locale="ko">
      <Box w={760} maw="calc(100vw - 2rem)" mx="auto" py="xl">
        <Stack gap="lg">
          <Title order={2}>설정</Title>

          <PersonalAccessTokenSettingsView
            token={null}
            labels={{
              title: '개인 액세스 토큰',
              description:
                'Geul이 제공하는 여러 API 서비스에서 이 단일 개인 액세스 토큰을 사용합니다. 모든 요청에는 현재 계정 권한이 적용됩니다. Remote MCP에서는 이 토큰을 사용할 수 없습니다.',
              empty: '생성된 개인 액세스 토큰이 없습니다.',
              created: '생성일',
              create: '만들기',
              regenerate: '재생성',
              delete: '삭제',
              copy: '복사',
              cancel: '취소',
              close: '닫기',
              regenerateTitle: '개인 액세스 토큰 재생성',
              regenerateConfirmation: '기존 토큰은 즉시 사용할 수 없게 됩니다.',
              deleteTitle: '개인 액세스 토큰 삭제',
              deleteConfirmation: '이 작업은 되돌릴 수 없습니다.',
              oneTimeTitle: '개인 액세스 토큰',
              oneTimeWarning: '이 토큰은 다시 표시되지 않습니다.',
              secret: '토큰',
              loadFailed: '개인 액세스 토큰을 불러오지 못했습니다.',
            }}
            onCreate={async () => false}
            onRegenerate={async () => false}
            onDelete={async () => false}
            onCopySecret={() => {}}
            onCloseSecret={() => {}}
          />

          <Divider />

          <McpIntegrationSettingsView
            endpoint="https://geul.example.invalid/mcp"
            setupGuideUrl="https://geul.example.invalid/guides/remote-mcp.md"
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

const meta = {
  title: 'Feature/My/MCP and API Access',
  component: McpAndApiAccessPreview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof McpAndApiAccessPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthorOrAdmin: Story = {};

export const NarrowViewport: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
