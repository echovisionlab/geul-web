import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { LayoutContainer } from '@/components/core/Layout';
import { TermsHistoryClient } from '@/app/(general)/terms/history/TermsHistoryClient';
import { PrivacyHistoryClient } from '@/app/(general)/privacy/history/PrivacyHistoryClient';
import type { PublicLegalHistoryInitialData } from '@/lib/queries/legal-history';
function LegalHistoryPreview({
  policy = 'terms',
  state = 'versions',
}: {
  policy?: 'terms' | 'privacy';
  state?: 'versions' | 'empty' | 'unknown-dates';
}) {
  const locale = useLocale();
  const client = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false, staleTime: Infinity } } }),
    [locale, policy, state],
  );
  const initialData: PublicLegalHistoryInitialData = {
    requestedLocale: locale,
    updatedAt: 1,
    active:
      state === 'empty'
        ? null
        : {
            id: 'preview-active',
            version: 3,
            effectiveFrom: state === 'unknown-dates' ? null : new Date('2026-10-01T00:00:00Z'),
          },
    archived:
      state === 'empty'
        ? []
        : [
            {
              id: 'preview-archived',
              version: 2,
              effectiveFrom: state === 'unknown-dates' ? null : new Date('2026-01-01T00:00:00Z'),
              effectiveUntil: new Date('2026-10-01T00:00:00Z'),
            },
          ],
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        {policy === 'terms' ? (
          <TermsHistoryClient initialData={initialData} />
        ) : (
          <PrivacyHistoryClient initialData={initialData} />
        )}
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Legal/History',
  component: LegalHistoryPreview,
  args: { policy: 'terms', state: 'versions' },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/terms/history', query: {} } },
    docs: {
      description: {
        component:
          'Actual route client owners with matching per-locale local initial data. Current/archived rows, effective-period formatting, navigation and empty states are production UI. Query transport is disabled; server-fetch and failure recovery are outside these fixture boundaries.',
      },
    },
  },
} satisfies Meta<typeof LegalHistoryPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Terms: Story = {};
export const TermsEmpty: Story = { args: { state: 'empty' } };
export const TermsUnknownDates: Story = { args: { state: 'unknown-dates' } };
export const Privacy: Story = {
  args: { policy: 'privacy' },
  parameters: { nextjs: { navigation: { pathname: '/privacy/history', query: {} } } },
};
export const PrivacyEmpty: Story = { args: { policy: 'privacy', state: 'empty' }, parameters: Privacy.parameters };
export const PrivacyUnknownDates: Story = {
  args: { policy: 'privacy', state: 'unknown-dates' },
  parameters: Privacy.parameters,
};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
