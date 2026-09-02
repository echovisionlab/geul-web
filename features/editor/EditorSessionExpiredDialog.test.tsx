// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
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

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('EditorSessionExpiredDialog', () => {
  it('does not render while closed', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider env="test">
            <EditorSessionExpiredDialog opened={false} onConfirm={vi.fn()} />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });

    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('renders a localized non-dismissible login action', () => {
    const onConfirm = vi.fn();
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider env="test">
            <EditorSessionExpiredDialog opened onConfirm={onConfirm} />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });

    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
    expect(dialog?.textContent).toContain('Session expired');
    expect(dialog?.textContent).toContain('Log in');
    expect(dialog?.querySelectorAll('button')).toHaveLength(1);

    act(() => dialog?.querySelector<HTMLButtonElement>('button')?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
