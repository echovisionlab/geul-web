// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { LegalShareDocumentView } from './LegalShareDocumentView';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (namespace === 'common.entities' && key === 'privacy') {
      return 'Generic privacy policy';
    }
    if (namespace === 'common.labels' && key === 'version') {
      return 'Version';
    }
    if (namespace === 'common.messages' && key === 'effectiveFromDate') {
      return `Effective from ${String(values?.date ?? '')}`;
    }
    if (namespace === 'legalHistoryDetailCommon' && key === 'effectiveUntil') {
      return `Effective until ${String(values?.date ?? '')}`;
    }
    if (namespace === 'legalPageCommon' && key === 'preview.upcomingAlert') {
      return `Scheduled for ${String(values?.date ?? '')}`;
    }
    return `${namespace}.${key}`;
  },
}));

vi.mock('@/features/navigation/TableOfContents', () => ({
  TableOfContents: () => null,
}));

describe('LegalShareDocumentView', () => {
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

  it('renders the exact localized document title instead of the generic domain label', () => {
    act(() => {
      root.render(
        <MantineProvider>
          <LegalShareDocumentView
            pathname="/s/share-token"
            document={{
              entityType: 'privacy',
              title: '9월 개인정보 처리방침',
              content: [],
              version: 4,
              effectiveFrom: '2026-09-01T00:00:00.000Z',
              effectiveUntil: '2026-09-30T00:00:00.000Z',
            }}
          />
        </MantineProvider>,
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('9월 개인정보 처리방침');
    expect(container.textContent).not.toContain('Generic privacy policy');
    expect(container.textContent).toContain('Version 4');
    expect(container.textContent).toContain('Effective from September 1, 2026');
    expect(container.textContent).toContain('Effective until September 30, 2026');
  });

  it('keeps the translated legal disclaimer visible and links to the original', () => {
    act(() => {
      root.render(
        <MantineProvider>
          <LegalShareDocumentView
            pathname="/s/share-token"
            document={{
              entityType: 'terms',
              title: 'Translated terms',
              content: [],
              version: 2,
              effectiveFrom: null,
              localizationInfo: {
                requestedLocale: 'en',
                displayedLocale: 'en',
                sourceLocale: 'ko',
                isFallback: false,
                isOriginal: false,
                machineGenerated: true,
                fallbackReason: 0,
              },
            }}
          />
        </MantineProvider>,
      );
    });

    const disclaimer = Array.from(container.querySelectorAll('*')).find(
      (node) => node.textContent === '참고 번역이며 원문이 우선합니다',
    );
    expect(disclaimer).toBeTruthy();
    expect(disclaimer?.closest('.print-hide')).toBeNull();
    expect(container.querySelector('a[href="/s/share-token?lang=ko"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label*="dismiss" i]')).toBeNull();
  });
});
