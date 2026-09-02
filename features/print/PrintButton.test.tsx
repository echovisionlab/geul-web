// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import { PrintButton } from './PrintButton';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe('PrintButton', () => {
  it('uses the shared print label and opens the native print dialog', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <PrintButton />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Print"]');
    expect(button).not.toBeNull();
    expect(button?.classList.contains('print-hide')).toBe(true);
    act(() => button?.click());
    expect(print).toHaveBeenCalledOnce();
  });
});
