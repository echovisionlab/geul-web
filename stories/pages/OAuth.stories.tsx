import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { McpConsentPageView } from '@/features/auth/McpConsentPageView';
import { LayoutContainer } from '@/components/core/Layout';
import { Alert } from '@/components/core/Alert';
export function OAuthConsentPagePreview({
  offlineAccess = true,
  clientName = 'Studio MCP',
  delegationName = 'June Han · studio@example.com',
}: {
  offlineAccess?: boolean;
  clientName?: string;
  delegationName?: string;
}) {
  const t = useTranslations('common');
  const mcp = useTranslations('security.mcpIntegration');
  const [completed, setCompleted] = useState<'approve' | 'reject' | null>(null);
  return completed ? (
    <LayoutContainer size="compact">
      <Alert tone={completed === 'approve' ? 'positive' : 'neutral'}>
        {completed === 'approve' ? t('statuses.applied') : t('actions.cancel')}
      </Alert>
    </LayoutContainer>
  ) : (
    <McpConsentPageView
      clientName={clientName}
      delegationName={delegationName}
      offlineAccess={offlineAccess}
      description={mcp('consentDescription')}
      offlineDescription={mcp('consentOfflineAccess')}
      revokeDescription={mcp('consentRevoke', { settings: t('labels.settings') })}
      cancelLabel={t('actions.cancel')}
      connectLabel={t('actions.connect')}
      approveAction={() => setCompleted('approve')}
      rejectAction={() => setCompleted('reject')}
    />
  );
}
const meta = {
  title: 'Pages/Auth/OAuth Consent',
  excludeStories: ['OAuthConsentPagePreview'],
  component: OAuthConsentPagePreview,
  args: { offlineAccess: true },
  render: (args) => <OAuthConsentPagePreview key={String(args.offlineAccess)} {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual McpConsentPageView used by the OAuth route. Actual approve/reject forms run local callbacks and display local completion. Challenge parsing, session/author checks, Hydra request/delegation validation, consent persistence and redirects remain in the server route and are outside this preview.',
      },
    },
  },
} satisfies Meta<typeof OAuthConsentPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OfflineAccess: Story = {};
export const SessionOnly: Story = { args: { offlineAccess: false } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const LongNames: Story = {
  args: {
    clientName: 'Studio workspace research and publishing integration',
    delegationName: 'A-long-workspace-account-name · research-publishing-account@example.com',
  },
};
