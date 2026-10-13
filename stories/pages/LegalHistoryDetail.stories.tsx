import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { TermsHistoryDetailClient } from '@/app/(general)/terms/history/[id]/TermsHistoryDetailClient';
import { PrivacyHistoryDetailClient } from '@/app/(general)/privacy/history/[id]/PrivacyHistoryDetailClient';
import type { PublicLegalHistoryDetailInitialData } from '@/lib/queries/legal-history';
export function LegalHistoryDetailPreview({
  policy = 'terms',
  state = 'archived',
}: {
  policy?: 'terms' | 'privacy';
  state?: 'archived' | 'missing' | 'unknown-dates';
}) {
  const locale = useLocale();
  const client = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false, staleTime: Infinity } } }),
    [locale, policy, state],
  );
  const initialData: PublicLegalHistoryDetailInitialData = {
    id: 'preview-archived',
    requestedLocale: locale,
    updatedAt: 1,
    data:
      state === 'missing'
        ? null
        : {
            id: 'preview-archived',
            version: 2,
            title: 'Listening room archive',
            content: null,
            localizationInfo: null,
            status: 'archived',
            effectiveFrom: state === 'unknown-dates' ? null : new Date('2026-01-01T00:00:00Z'),
            effectiveUntil: state === 'unknown-dates' ? null : new Date('2026-10-01T00:00:00Z'),
            createdAt: null,
          },
  };
  return (
    <QueryClientProvider client={client}>
      {policy === 'terms' ? (
        <TermsHistoryDetailClient id={initialData.id} initialData={initialData} />
      ) : (
        <PrivacyHistoryDetailClient id={initialData.id} initialData={initialData} />
      )}
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Legal/History Detail',
  excludeStories: ['LegalHistoryDetailPreview'],
  component: LegalHistoryDetailPreview,
  args: { policy: 'terms', state: 'archived' },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/terms/history/preview-archived', query: {} } },
    docs: {
      description: {
        component:
          'Actual archived terms/privacy page clients with matching local initial data and disabled query transport. Archived/missing/unknown effective date views, metadata, history links and print action. Rich-text content, localized fallback metadata, query failure recovery, edit branch and server access remain outside.',
      },
    },
  },
} satisfies Meta<typeof LegalHistoryDetailPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Terms: Story = {};
export const TermsMissing: Story = { args: { state: 'missing' } };
export const TermsUnknownDates: Story = { args: { state: 'unknown-dates' } };
export const Privacy: Story = {
  args: { policy: 'privacy' },
  parameters: { nextjs: { navigation: { pathname: '/privacy/history/preview-archived', query: {} } } },
};
export const PrivacyMissing: Story = { args: { policy: 'privacy', state: 'missing' }, parameters: Privacy.parameters };
export const PrivacyUnknownDates: Story = {
  args: { policy: 'privacy', state: 'unknown-dates' },
  parameters: Privacy.parameters,
};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
