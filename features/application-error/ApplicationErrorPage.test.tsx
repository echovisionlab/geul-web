// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import koMessages from '@/messages/ko.json';
import { ApplicationErrorPage } from './ApplicationErrorPage';

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
