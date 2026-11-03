import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState, useCallback, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { Alert } from '@/components/core/Alert';
import AdminFormSubmissionsPage from '@/features/form/AdminFormSubmissionsPage';
import { FormDashboardView } from '@/features/form/FormDashboardView';
import { FormPasswordContent } from '@/features/form/FormPasswordContent';
import { FormSubmissionDetailPageView } from '@/features/form/FormSubmissionDetailPageView';
import { actionSuccess, actionFailure } from '@/lib/actions/action-result';
import type { PublicFormDashboardData } from '@/lib/actions/form';
import type { FormSchema } from '@/lib/types/form/schema';
const formId = 'preview-form';
const rows = [
  {
    id: 'submission-1',
    formId,
    memberId: undefined,
    data: { name: 'June Han', email: 'june@example.com', subscribe: true },
    ipAddress: '192.0.2.1',
    countryCode: 'KR',
    userAgent: 'Preview',
    createdAt: new Date('2026-09-12T10:00:00Z'),
  },
  {
    id: 'submission-2',
    formId,
    memberId: 'member-1',
    data: { name: 'Night Signals', email: 'night@example.com', subscribe: false },
    ipAddress: '192.0.2.2',
    countryCode: 'US',
    userAgent: 'Preview',
    createdAt: new Date('2026-09-13T10:00:00Z'),
  },
];
export function FormOperationsPreview({
  surface = 'submissions',
  state = 'ready',
  embedded = false,
}: {
  surface?: 'submissions' | 'detail' | 'dashboard' | 'password';
  state?: 'ready' | 'empty' | 'failed' | 'pending' | 'locked' | 'invalid';
  embedded?: boolean;
}) {
  const renderContainer = (content: ReactNode) =>
    embedded ? content : <LayoutContainer size="wide">{content}</LayoutContainer>;
  const locale = useLocale(),
    t = useTranslations('common');
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  const [records] = useState(() => ({ current: state === 'empty' ? [] : rows }));
  const [complete, setComplete] = useState(false);
  const onNavigate = useCallback(() => setComplete(true), []);
  const fieldStats: PublicFormDashboardData['fieldStats'] =
    state === 'empty'
      ? {}
      : {
          session: {
            fieldId: 'session',
            fieldLabel: 'Session',
            values: [
              { value: 'Morning', count: 8 },
              { value: 'Evening', count: 16 },
            ],
          },
        };
  const schema: FormSchema = {
    id: formId,
    steps: [
      {
        id: 'identity',
        title: t('labels.name'),
        fields: [
          { id: 'name', name: 'name', type: 'text', label: t('labels.name') },
          { id: 'email', name: 'email', type: 'email', label: t('labels.email') },
          { id: 'subscribe', name: 'subscribe', type: 'checkbox', label: t('labels.status') },
        ],
      },
    ],
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutStack gap="md">
        {complete && <Alert tone="positive">{t('actions.confirm')}</Alert>}
        {complete ? null : surface === 'submissions' ? (
          renderContainer(
            <AdminFormSubmissionsPage
              formId={formId}
              editBaseHref="/admin/forms/preview-form/submissions"
              listAction={async (input) => {
                if (state === 'pending') {
                  return new Promise(() => {});
                }
                if (state === 'failed') {
                  return actionFailure(t('messages.failedToLoad'), 'LIST_SUBMISSIONS_FAILED', {
                    code: 'LIST_SUBMISSIONS_FAILED',
                  });
                }
                const filtered = records.current
                  .filter(
                    (row) =>
                      (!input.search || JSON.stringify(row.data).toLowerCase().includes(input.search.toLowerCase())) &&
                      (!input.countryCode || row.countryCode === input.countryCode) &&
                      (!input.dateFrom || row.createdAt >= new Date(input.dateFrom)) &&
                      (!input.dateTo || row.createdAt < new Date(input.dateTo)),
                  )
                  .sort((a, b) =>
                    input.sortOrder === 'asc'
                      ? a.createdAt.getTime() - b.createdAt.getTime()
                      : b.createdAt.getTime() - a.createdAt.getTime(),
                  );
                const page = input.page ?? 1,
                  limit = input.limit ?? 20;
                return actionSuccess({
                  data: {
                    submissions: filtered.slice((page - 1) * limit, page * limit),
                    total: filtered.length,
                    page,
                    limit,
                    totalPages: Math.ceil(filtered.length / limit),
                  },
                });
              }}
              deleteAction={async (id) => {
                records.current = records.current.filter((row) => row.id !== id);
                return actionSuccess({ success: true });
              }}
            />,
          )
        ) : surface === 'detail' ? (
          renderContainer(
            <FormSubmissionDetailPageView
              formId={formId}
              submission={rows[0]}
              formSchema={schema}
              deleteAction={async () =>
                state === 'failed'
                  ? actionFailure(t('messages.failedToLoad'), 'FORM_DELETE_SUBMISSION_FAILED')
                  : actionSuccess({ success: true })
              }
              onDeleted={() => setComplete(true)}
            />,
          )
        ) : surface === 'dashboard' ? (
          <FormDashboardView
            slug="listening-room"
            shareToken={state === 'invalid' ? '' : 'local-share'}
            requestedLocale={locale}
            accessAction={async () =>
              state === 'pending'
                ? new Promise(() => {})
                : state === 'locked'
                  ? { accessible: false, reason: 'password_required', form: null }
                  : { accessible: true, form: null }
            }
            dashboardAction={async () =>
              state === 'failed'
                ? { ok: false, status: 503, error: t('messages.failedToLoad') }
                : {
                    ok: true,
                    value: {
                      formId,
                      formTitle: 'Listening Room',
                      formSlug: 'listening-room',
                      totalSubmissions: state === 'empty' ? 0 : 24,
                      submissionsToday: state === 'empty' ? 0 : 2,
                      submissionsThisWeek: state === 'empty' ? 0 : 8,
                      submissionsThisMonth: state === 'empty' ? 0 : 24,
                      fieldStats,
                    },
                  }
            }
          />
        ) : (
          <FormPasswordContent
            slug={`listening-room-${state}`}
            shareToken="local-share"
            requestedLocale={locale}
            accessAction={async () =>
              state === 'pending'
                ? new Promise(() => {})
                : { accessible: false, reason: 'password_required', form: null }
            }
            verifyAction={async (_slug, password) =>
              state === 'failed'
                ? { ok: false, status: 503, error: t('messages.failedToLoad') }
                : { ok: true, value: { valid: password === 'signal' } }
            }
            onNavigate={onNavigate}
          />
        )}
      </LayoutStack>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Forms/Operations',
  excludeStories: ['FormOperationsPreview'],
  component: FormOperationsPreview,
  args: { surface: 'submissions', state: 'ready' },
  render: (args) => <FormOperationsPreview key={`${args.surface}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/forms/preview-form/submissions' } },
    docs: {
      description: {
        component:
          'Actual AdminFormSubmissionsPage query/delete controller, production FormSubmissionDetailPageView extracted unchanged from the route, shared FormDashboardView access/data controller and FormPasswordContent. Local typed transports implement text/country/date filters, chronological sort and pagination; actual deletion confirmation removes fixture rows. Dashboard uses real field charts. Password signal exercises the actual verification flow; the HttpOnly access cookie is set by the server action outside Storybook, and final navigation is captured locally. Auth, server schema projection, signed share validation, persistence and delivery remain outside. Submission metadata labels retain the existing production language.',
      },
    },
  },
} satisfies Meta<typeof FormOperationsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Submissions: Story = {};
export const SubmissionsEmpty: Story = { args: { state: 'empty' } };
export const SubmissionsFailed: Story = { args: { state: 'failed' } };
export const SubmissionsPending: Story = { args: { state: 'pending' } };
export const Detail: Story = { args: { surface: 'detail' } };
export const DetailDeleteFailed: Story = { args: { surface: 'detail', state: 'failed' } };
export const Dashboard: Story = { args: { surface: 'dashboard' } };
export const DashboardPending: Story = { args: { surface: 'dashboard', state: 'pending' } };
export const DashboardEmpty: Story = { args: { surface: 'dashboard', state: 'empty' } };
export const DashboardLocked: Story = { args: { surface: 'dashboard', state: 'locked' } };
export const DashboardInvalid: Story = { args: { surface: 'dashboard', state: 'invalid' } };
export const DashboardFailed: Story = { args: { surface: 'dashboard', state: 'failed' } };
export const Password: Story = { args: { surface: 'password' } };
export const PasswordFailed: Story = { args: { surface: 'password', state: 'failed' } };
export const PasswordPending: Story = { args: { surface: 'password', state: 'pending' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
