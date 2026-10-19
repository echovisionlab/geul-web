// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    if (namespace === 'localizationNotice' && key === 'translated.description') {
      return `Shown in ${String(values?.displayed)}; the ${String(values?.source)} original prevails.`;
    }
    if (namespace === 'legalPageCommon' && key === 'preview.upcomingAlert') {
      return `Scheduled for ${String(values?.date ?? '')}`;
    }
    return `${namespace}.${key}`;
  },
}));

vi.mock('@/features/navigation/TableOfContents', () => ({
  // The navigation owner wraps the document so Core can reserve the outline beside it.
  TableOfContents: ({ children }: { children: React.ReactNode }) => children,
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
        <DesignSystemProvider forceColorScheme="light">
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
        </DesignSystemProvider>,
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
        <DesignSystemProvider forceColorScheme="light">
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
        </DesignSystemProvider>,
      );
    });

    // The notice speaks the interface language (English here) and names both languages.
    const disclaimer = Array.from(container.querySelectorAll('*')).find(
      (node) => node.textContent === 'Shown in English; the Korean original prevails.',
    );
    expect(disclaimer).toBeTruthy();
    expect(disclaimer?.closest('[lang]')?.getAttribute('lang')).not.toBe('ko');
    expect(container.querySelector('.terms-content')).toHaveAttribute('lang', 'en');
    expect(disclaimer?.closest('.print-hide')).toBeNull();
    expect(container.querySelector('a[href="/s/share-token?lang=ko"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label*="dismiss" i]')).toBeNull();
  });
});
