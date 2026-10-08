// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { theme } from '@/theme';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '@/lib/i18n/error-messages.json';
import { SUPPORTED_LOCALES } from '@/lib/i18n/locale';
import { RootErrorPageView } from './RootErrorPageView';

describe('root error fallback', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    document.body.replaceChildren();
  });

  it('offers a working retry and home link with only its local site theme', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const retry = vi.fn();
    await act(async () =>
      root!.render(
        <MantineProvider theme={theme} env="test">
          <RootErrorPageView locale="ko" onRetry={retry} />
        </MantineProvider>,
      ),
    );
    expect(container.querySelector('h1')?.textContent).toBe(messages.ko.title);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
    await act(async () => container.querySelector('button')!.click());
    expect(retry).toHaveBeenCalledOnce();
    expect(container.querySelector('button')?.getAttribute('data-emphasis')).toBe('strong');
  });

  it('keeps the provider-free fallback synchronized with every supported language', () => {
    expect(Object.keys(messages).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
      const catalogue = JSON.parse(readFileSync(`${process.cwd()}/messages/${locale}.json`, 'utf8'));
      expect(messages[locale]).toEqual({ ...catalogue.generalError, tryAgain: catalogue.common.actions.tryAgain });
    }
  });
});
