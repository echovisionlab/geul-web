// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import enMessages from '@/messages/en.json';
import { MapThemeEditorInterruptionDialogs } from './MapThemeEditorInterruptionDialogs';

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
  window.history.replaceState(null, '', '/admin/map/themes/theme-1?locale=ko#palette');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function renderDialogs({ interruption }: { interruption: 'permission_revoked' | 'session_expired' | null }) {
  const navigate = vi.fn();

  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MantineProvider env="test">
          <MapThemeEditorInterruptionDialogs interruption={interruption} navigate={navigate} />
        </MantineProvider>
      </NextIntlClientProvider>,
    );
  });

  act(() => {
    document.body.querySelector<HTMLButtonElement>('[role="alertdialog"] button')?.click();
  });

  return { navigate };
}

describe('MapThemeEditorInterruptionDialogs', () => {
  it('returns a revoked editor to the site home', () => {
    const { navigate } = renderDialogs({ interruption: 'permission_revoked' });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('starts login with the exact current page as return target', () => {
    const { navigate } = renderDialogs({ interruption: 'session_expired' });
    expect(navigate).toHaveBeenCalledWith('/login?redirect=%2Fadmin%2Fmap%2Fthemes%2Ftheme-1%3Flocale%3Dko%23palette');
  });

  it('shows no blocking dialog without an access interruption', () => {
    renderDialogs({ interruption: null });
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
