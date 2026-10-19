// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { ContentLocaleNotice } from './ContentLocaleNotice';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    `${key}${
      values
        ? ` ${Object.entries(values)
            .map(([name, value]) => `${name}=${value}`)
            .join(' ')}`
        : ''
    }`,
}));

function renderNotice(
  info: { requestedLocale: string; displayedLocale: string; sourceLocale: string },
  announce = false,
) {
  return render(
    <DesignSystemProvider forceColorScheme="light">
      <ContentLocaleNotice pathname="/products/topofon" localizationInfo={info} announceTranslation={announce} />
    </DesignSystemProvider>,
  );
}

describe('ContentLocaleNotice', () => {
  it('names the unavailable language and the shown one in the interface language', () => {
    renderNotice({ requestedLocale: 'nl', displayedLocale: 'en', sourceLocale: 'ko' });
    expect(screen.getByText('fallback.description requested=Dutch displayed=English')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/products/topofon?lang=ko');
  });

  it('offers no original when the original is what is shown', () => {
    renderNotice({ requestedLocale: 'nl', displayedLocale: 'ko', sourceLocale: 'ko' });
    expect(screen.getByText('fallback.description requested=Dutch displayed=Korean')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('stays silent on a requested translation unless the translation is announced', () => {
    const info = { requestedLocale: 'de', displayedLocale: 'de', sourceLocale: 'ko' };
    const { container, unmount } = renderNotice(info);
    expect(container.textContent).toBe('');
    unmount();
    renderNotice(info, true);
    expect(screen.getByText('translated.description displayed=German source=Korean')).toBeTruthy();
  });
});
