// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('PostSessionExpiredDialog', () => {
  it('starts login with the exact editor URL as return target', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let completed!: () => void;
    const confirmation = new Promise<void>((resolve) => {
      completed = resolve;
    });
    const navigate = vi.fn(() => completed());
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <DesignSystemProvider locale="en" forceColorScheme="light">
            <PostSessionExpiredDialog opened returnTo="/posts/post-1?edit=true&locale=ko#body" navigate={navigate} />
          </DesignSystemProvider>
        </NextIntlClientProvider>,
      );
    });

    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('[role="alertdialog"] button')?.click();
      await confirmation;
      vi.advanceTimersByTime(2_000);
    });

    expect(navigate).toHaveBeenCalledWith('/login?redirect=%2Fposts%2Fpost-1%3Fedit%3Dtrue%26locale%3Dko%23body');
  });
});
