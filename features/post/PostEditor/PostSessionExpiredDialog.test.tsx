// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import enMessages from '@/messages/en.json';
import { PostSessionExpiredDialog } from './PostSessionExpiredDialog';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('PostSessionExpiredDialog', () => {
  it('starts login with the exact editor URL as return target', () => {
    const navigate = vi.fn();
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider env="test">
            <PostSessionExpiredDialog opened returnTo="/posts/post-1?edit=true&locale=ko#body" navigate={navigate} />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });

    act(() => {
      document.body.querySelector<HTMLButtonElement>('[role="alertdialog"] button')?.click();
    });

    expect(navigate).toHaveBeenCalledWith('/login?redirect=%2Fposts%2Fpost-1%3Fedit%3Dtrue%26locale%3Dko%23body');
  });
});
