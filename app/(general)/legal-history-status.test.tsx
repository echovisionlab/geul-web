import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PublicLegalHistoryDetail } from '@/lib/queries/legal-history';
import { TestProviders } from '@/test/TestProviders';

import { PrivacyHistoryDetailClient } from './privacy/history/[id]/PrivacyHistoryDetailClient';
import { TermsHistoryDetailClient } from './terms/history/[id]/TermsHistoryDetailClient';

function renderVersion(
  Component: typeof PrivacyHistoryDetailClient | typeof TermsHistoryDetailClient,
  status: PublicLegalHistoryDetail['status'],
) {
  const data: PublicLegalHistoryDetail = {
    id: 'opened-version',
    version: 2,
    title: 'Legal document',
    content: [],
    localizationInfo: null,
    status,
    effectiveFrom: new Date('2026-08-01T00:00:00Z'),
    effectiveUntil: null,
    createdAt: null,
  };
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <TestProviders>
        <Component
          id="opened-version"
          initialData={{ id: 'opened-version', requestedLocale: 'en', updatedAt: 1, data }}
        />
      </TestProviders>
    </QueryClientProvider>,
  );
}

describe.each([
  ['privacy', PrivacyHistoryDetailClient],
  ['terms', TermsHistoryDetailClient],
] as const)('%s history detail status', (_domain, Component) => {
  it('shows Active for the current version opened through history', () => {
    const html = renderVersion(Component, 'active');

    expect(html).toContain('>Active<');
    expect(html).not.toContain('Archived');
  });

  it('shows Archived for a superseded version', () => {
    const html = renderVersion(Component, 'archived');

    expect(html).toContain('>Archived<');
    expect(html).not.toContain('>Active<');
  });
});
