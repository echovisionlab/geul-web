// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '@/messages/en.json';
import { EditorSessionExpiredDialog } from './EditorSessionExpiredDialog';

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

describe('EditorSessionExpiredDialog', () => {
  it('does not render while closed', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <DesignSystemProvider locale="en" forceColorScheme="light">
            <EditorSessionExpiredDialog opened={false} onConfirm={vi.fn()} />
          </DesignSystemProvider>
        </NextIntlClientProvider>,
      );
    });

    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('renders a localized non-dismissible login action', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let completed!: () => void;
    const confirmation = new Promise<void>((resolve) => {
      completed = resolve;
    });
    const onConfirm = vi.fn(() => completed());
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <DesignSystemProvider locale="en" forceColorScheme="light">
            <EditorSessionExpiredDialog opened onConfirm={onConfirm} />
          </DesignSystemProvider>
        </NextIntlClientProvider>,
      );
    });

    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
    expect(dialog?.textContent).toContain('Session expired');
    expect(dialog?.textContent).toContain('Log in');
    expect(dialog?.querySelectorAll('button')).toHaveLength(1);

    await act(async () => {
      dialog?.querySelector<HTMLButtonElement>('button')?.click();
      // Wait for the real durable-edit preparation and resulting navigation.
      await confirmation;
      // This test's navigation spy keeps the page open; settle its resume timer.
      vi.advanceTimersByTime(2_000);
    });
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
