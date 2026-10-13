// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import koMessages from '@/messages/ko.json';
import { ApplicationErrorPage } from './ApplicationErrorPage';
import { getFallbackErrorPageMessages } from './error-page-fallback-messages';
import { getErrorPageContent } from './error-status';

let root: ReturnType<typeof createRoot> | undefined;
let container: HTMLDivElement;

async function render(status: number, retry = vi.fn()) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <DesignSystemProvider forceColorScheme="light">
          <ApplicationErrorPage status={status} onRetry={retry} fullScreen />
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    ),
  );
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe('shared application error surface', () => {
  it.each([400, 401, 403, 404, 408, 409, 410, 413, 422, 429, 500, 501, 502, 503, 504])(
    'uses the same number/title/action structure for %s',
    async (status) => {
      await render(status);
      const section = container.querySelector('[data-error-page]')!;
      expect(section.querySelector('[data-error-code]')?.getAttribute('data-error-code')).toBe(String(status));
      expect(section.querySelector('h1')?.textContent).toBe(
        getErrorPageContent(status, getFallbackErrorPageMessages('ko')).title,
      );
      expect(container.querySelector('a[href="/"]')?.textContent).toBe('홈으로 가기');
      for (const action of section.querySelectorAll('a, button')) {
        expect(action.getAttribute('data-emphasis')).toBe('low');
      }
    },
  );

  it('preserves a working retry on server failures', async () => {
    const retry = vi.fn();
    await render(503, retry);
    await act(async () => container.querySelector('button')!.click());
    expect(retry).toHaveBeenCalledOnce();
  });

  it('provides login for 401 and does not retry denied access', async () => {
    await render(401);
    expect(container.querySelector('a[href="/login"]')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
    await act(async () =>
      root!.render(
        <NextIntlClientProvider locale="ko" messages={koMessages}>
          <DesignSystemProvider forceColorScheme="light">
            <ApplicationErrorPage status={403} onRetry={vi.fn()} />
          </DesignSystemProvider>
        </NextIntlClientProvider>,
      ),
    );
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('a[href="/login"]')).toBeNull();
  });
});
