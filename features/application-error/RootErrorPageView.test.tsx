// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '@/lib/i18n/error-page-messages.json';
import { SUPPORTED_LOCALES } from '@/lib/i18n/locale';
import { RootErrorPageView } from './RootErrorPageView';
import { within } from '@/test/render';

describe('root error fallback', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;
  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    root = undefined;
    container?.remove();
    container = undefined;
  });

  it('offers a working retry and home link with only its local site theme', async () => {
    const host = document.createElement('div');
    container = host;
    document.body.append(host);
    root = createRoot(host);
    const recovery = Promise.withResolvers<void>();
    const retry = vi.fn(() => recovery.promise);
    await act(async () =>
      root!.render(
        <DesignSystemProvider>
          <RootErrorPageView locale="ko" onRetry={retry} />
        </DesignSystemProvider>,
      ),
    );
    const page = within(host);
    expect(page.getByRole('heading', { level: 1 })).toHaveTextContent(messages.ko.titles['500']);
    expect(page.getByRole('link')).toHaveAttribute('href', '/');
    const button = page.getByRole('button');
    await act(async () => button.click());
    expect(retry).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(page.getByRole('progressbar', { name: messages.ko.actions.tryAgain })).toBeVisible();
    await act(async () => button.click());
    expect(retry).toHaveBeenCalledOnce();
    await act(async () => recovery.resolve());
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).toHaveAttribute('data-emphasis', 'low');
  });

  it('keeps the provider-free fallback synchronized with every supported language', () => {
    expect(Object.keys(messages).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
      const catalogue = JSON.parse(readFileSync(`${process.cwd()}/messages/${locale}.json`, 'utf8'));
      expect(messages[locale].titles['404']).toBe(catalogue.notFoundPage.title);
      expect(messages[locale].titles['500']).toBe(catalogue.generalError.title);
      expect(messages[locale].actions).toEqual({
        goHome: catalogue.notFoundPage.goHome,
        tryAgain: catalogue.common.actions.tryAgain,
        login: catalogue.common.actions.backToLogin,
      });
      expect(Object.values(messages[locale].titles).every((title) => title.length > 0)).toBe(true);
      // In-layout error surfaces read the same copy from the client catalogue's errorPage namespace.
      expect(catalogue.errorPage).toEqual(messages[locale]);
    }
  });
});
