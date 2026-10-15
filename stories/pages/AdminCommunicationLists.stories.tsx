import { useState } from 'react';
import { navigatePreview } from '../shared/preview-navigation';
import { Code } from '@connectrpc/connect';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LayoutContainer } from '@/components/core/Layout';
import { FormsPageView } from '@/features/admin/form/FormsPageView';
import { CampaignsPageView } from '@/features/admin/campaign/CampaignsPageView';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import { parseTableQuery } from '@/lib/utils/table-url';
import { tableRows } from './fixtures/table-query';
import { actionSuccess, actionFailure } from '@/lib/actions/action-result';
const date = new Date('2026-10-01T00:00:00Z');
const initialForms = [
  {
    id: 'local-form-1',
    title: 'Listening room registration',
    slug: 'listening-room',
    status: 'published',
    submissionCount: 24,
    createdAt: date,
  },
  {
    id: 'local-form-2',
    title: 'Upcoming event',
    slug: undefined,
    status: 'draft',
    submissionCount: 0,
    createdAt: date,
  },
];
const initialCampaigns = [
  {
    id: 'local-campaign-1',
    name: 'Night Signals',
    subject: 'Listening room · October',
    status: 'sent',
    sentCount: 82,
    createdAt: date,
  },
  {
    id: 'local-campaign-2',
    name: 'Upcoming event',
    subject: 'New programme',
    status: 'draft',
    sentCount: 0,
    createdAt: date,
  },
];
export function CommunicationListsPreview({
  domain = 'forms',
  state = 'ready',
}: {
  domain?: 'forms' | 'campaigns';
  state?: 'ready' | 'empty' | 'failed' | 'action-failed';
}) {
  const t = useTranslations('common');
  const [client] = useState(() => new QueryClient());
  const [forms, setForms] = useState(state === 'empty' ? [] : initialForms);
  const [campaigns, setCampaigns] = useState(state === 'empty' ? [] : initialCampaigns);
  const [url, setUrl] = useState('');
  const params = new URLSearchParams(url),
    query = parseTableQuery(params, domain);
  const fields = [
    { field: domain === 'forms' ? 'title' : 'name', label: t('labels.title'), type: 'string' as const },
    { field: 'status', label: t('labels.status'), type: 'string' as const },
  ];
  const shared = {
    title: t(`entities.${domain}`),
    searchParams: params.toString(),
    filterFields: fields,
    sortFields: fields.map(({ field, label }) => ({ field, label })),
    searchPlaceholder: t('placeholders.search'),
  };
  const result = <T extends { id: string }>(rows: T[]) => ({
    ...tableRows(
      rows,
      query,
      (row) =>
        Object.values(row)
          .filter((value) => typeof value === 'string')
          .join(' '),
      (row, key) => Object.entries(row).find(([name]) => name === key)?.[1],
    ),
    ...(state === 'failed' ? { error: t('messages.failedToLoad') } : {}),
  });
  const deleteForm = async (id: string) => {
    if (state === 'action-failed') {
      return actionFailure('Local delete failed', 'FORM_DELETE_FAILED');
    }
    setForms((rows) => rows.filter((row) => row.id !== id));
    return actionSuccess({ success: true as const });
  };
  const deleteCampaign = async (id: string) => {
    if (state === 'action-failed') {
      return actionFailure('Local delete failed', Code.Internal);
    }
    setCampaigns((rows) => rows.filter((row) => row.id !== id));
    return actionSuccess({ success: true as const });
  };
  return (
    <QueryClientProvider client={client}>
      <ServerDataTableNavigationProvider
        value={{
          pathname: `/admin/${domain}`,
          searchParams: params,
          push: (href) => setUrl(new URL(href, 'https://preview.invalid').search),
          refresh: () => {},
        }}
      >
        <LayoutContainer size="wide" inset="md">
          {domain === 'forms' ? (
            <FormsPageView
              {...shared}
              result={result(forms)}
              deleteAction={deleteForm}
              modalBindings={{ deleteAction: deleteForm, refresh: () => {} }}
              createBindings={{
                navigate: navigatePreview,
                createAction: async () => {
                  if (state === 'action-failed') {
                    return actionFailure('Local create failed', 'FORM_CREATE_FAILED');
                  }
                  const id = `local-form-${forms.length + 1}`;
                  setForms((rows) => [...rows, { ...initialForms[1], id }]);
                  return actionSuccess({ data: { id } });
                },
              }}
            />
          ) : (
            <CampaignsPageView
              {...shared}
              result={result(campaigns)}
              modalBindings={{ deleteAction: deleteCampaign, refresh: () => {} }}
              createBindings={{
                navigate: navigatePreview,
                createAction: async () => {
                  if (state === 'action-failed') {
                    return actionFailure('Local create failed', Code.Internal);
                  }
                  const id = `local-campaign-${campaigns.length + 1}`;
                  setCampaigns((rows) => [...rows, { ...initialCampaigns[1], id }]);
                  return actionSuccess({ data: { id } });
                },
              }}
            />
          )}
        </LayoutContainer>
      </ServerDataTableNavigationProvider>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Communication Lists',
  excludeStories: ['CommunicationListsPreview'],
  component: CommunicationListsPreview,
  args: { domain: 'forms', state: 'ready' },
  render: (args) => <CommunicationListsPreview key={`${args.domain}:${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual production FormsPageView and CampaignsPageView with original table, header, selection, row menus, pagination and modal owners. Create/delete use local typed actions; URL controls use fixture transport. Fixture scalar filters only; server access, publication, audience evaluation, mail sending and destination edit pages are separate.',
      },
    },
  },
} satisfies Meta<typeof CommunicationListsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Forms: Story = {};
export const FormsEmpty: Story = { args: { state: 'empty' } };
export const FormsFailed: Story = { args: { state: 'failed' } };
export const FormsActionFailed: Story = { args: { state: 'action-failed' } };
export const Campaigns: Story = { args: { domain: 'campaigns' } };
export const CampaignsEmpty: Story = { args: { domain: 'campaigns', state: 'empty' } };
export const CampaignsFailed: Story = { args: { domain: 'campaigns', state: 'failed' } };
export const CampaignsActionFailed: Story = { args: { domain: 'campaigns', state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
