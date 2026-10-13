import { expect, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { LayoutContainer } from '@/components/core/Layout';
import CampaignAnalyticsPage, { type CampaignAnalyticsBindings } from '@/features/campaign/CampaignAnalyticsPage';
import type { Campaign, CampaignDeliveryRecipient } from '@/lib/actions/campaign';
const date = new Date('2026-10-01T00:00:00Z');
const campaign: Campaign = {
  id: 'local-campaign',
  name: 'Listening room invitation',
  subject: 'Night Signals · October',
  status: 'sent',
  targetMode: CampaignTargetMode.ALL,
  recipientScope: 'SUBSCRIBED_USERS',
  sentCount: 82,
  createdAt: date,
  updatedAt: date,
  sentAt: date,
};
const recipients: CampaignDeliveryRecipient[] = Array.from({ length: 53 }, (_, index) => ({
  email: `listener-${index + 1}@example.com`,
  memberId: `member-${index + 1}`,
  status: index % 4 === 0 ? 'blocked' : 'sent',
  terminalAt: date,
  errorType: index % 4 === 0 ? 'ACCOUNT_INELIGIBLE' : undefined,
}));
export function CampaignAnalyticsPreview({ state = 'ready' }: { state?: 'ready' | 'empty' | 'failed' | 'pending' }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const gate = async () => {
    if (state === 'pending') {
      await new Promise(() => {});
    }
    if (state === 'failed') {
      throw new Error('Campaign analytics unavailable');
    }
  };
  const bindings: CampaignAnalyticsBindings = {
    getCampaign: async () => {
      await gate();
      return { ok: true, value: campaign };
    },
    getStats: async () => {
      await gate();
      return {
        ok: true,
        value: {
          totalSent: state === 'empty' ? 0 : 40,
          totalSkipped: 0,
          totalFailed: 0,
          totalBlocked: state === 'empty' ? 0 : 13,
          totalSuppressed: 0,
        },
      };
    },
    getRecipients: async (_id, limit = 100, offset = 0) => {
      await gate();
      return {
        ok: true,
        value: {
          recipients: state === 'empty' ? [] : recipients.slice(offset, offset + limit),
          total: state === 'empty' ? 0 : recipients.length,
        },
      };
    },
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <CampaignAnalyticsPage id={campaign.id} bindings={bindings} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Campaign/Analytics',
  excludeStories: ['CampaignAnalyticsPreview'],
  component: CampaignAnalyticsPreview,
  args: { state: 'ready' },
  render: (args) => <CampaignAnalyticsPreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/campaigns/local-campaign/analytics' } },
    docs: {
      description: {
        component:
          'Actual canonical/admin analytics controller, metrics, recipient statuses and page controls with local typed readers. Backend authorization and delivery are outside. No campaign send action is invoked.',
      },
    },
  },
} satisfies Meta<typeof CampaignAnalyticsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Pending: Story = { args: { state: 'pending' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const RecipientSemantics: Story = {
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const table = await canvas.findByRole('table', { name: t.common('labels.recipients') });
    await expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(1);
    await expect(within(table).getByText('listener-1@example.com')).toBeInTheDocument();
    const region = canvas.getByRole('region', { name: t.common('labels.email') });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toContainElement(table);
  },
};
