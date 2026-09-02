// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { PrivacyHistoryDetailClient } from './privacy/history/[id]/PrivacyHistoryDetailClient';
import { TermsHistoryDetailClient } from './terms/history/[id]/TermsHistoryDetailClient';

const queryResult = vi.hoisted(() => ({
  data: null as null | Record<string, unknown>,
  isLoading: false,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => queryResult,
}));

vi.mock('@/lib/queries/privacy-browser', () => ({
  getArchivedPrivacy: vi.fn(),
}));

vi.mock('@/lib/queries/terms-browser', () => ({
  getArchivedTerms: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => {
    const translate = (key: string) => `${namespace}.${key}`;
    return Object.assign(translate, { rich: translate });
  },
}));

vi.mock('@/features/navigation/TableOfContents', () => ({
  TableOfContents: () => null,
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: () => <div>Loading</div>,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('legal history exact-version status', () => {
  it.each([
    ['privacy', PrivacyHistoryDetailClient],
    ['terms', TermsHistoryDetailClient],
  ] as const)('shows Active for a current %s version opened through history', (_domain, Component) => {
    queryResult.data = {
      id: 'current-version',
      version: 2,
      title: 'Current legal document',
      content: [],
      status: 'active',
      effectiveFrom: new Date('2026-08-01T00:00:00Z'),
      effectiveUntil: null,
    };

    act(() => {
      root.render(
        <MantineProvider>
          <Component id="current-version" />
        </MantineProvider>,
      );
    });

    expect(container.textContent).toContain('common.statuses.active');
    expect(container.textContent).not.toContain('common.statuses.archived');
  });
});
