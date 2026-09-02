// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import enMessages from '@/messages/en.json';
import { PostPermissionRevokedDialog } from './PostPermissionRevokedDialog';

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

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
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

function renderDialog(
  resolveDestination: (postId: string) => Promise<string>,
  navigate: (destination: string) => void,
) {
  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MantineProvider env="test">
          <PostPermissionRevokedDialog
            opened
            postId="post-1"
            resolveDestination={resolveDestination}
            navigate={navigate}
          />
        </MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe('PostPermissionRevokedDialog', () => {
  it('keeps the blocking result actionable when fresh and fallback navigation both fail', async () => {
    renderDialog(
      vi.fn().mockResolvedValue('/posts/latest-slug'),
      vi.fn(() => {
        throw new Error('blocked');
      }),
    );
    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
    const button = dialog?.querySelector<HTMLButtonElement>('button');

    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(dialog?.querySelector<HTMLButtonElement>('button')?.disabled).toBe(false);
    expect(notifications.show).toHaveBeenCalledWith({
      message: 'Could not leave the editor. Try again.',
      color: 'red',
    });
  });
});
