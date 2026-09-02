// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en.json';
import { PageEditorInterruptionDialogs } from './PageEditorInterruptionDialogs';

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
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function renderDialogs(props: Partial<React.ComponentProps<typeof PageEditorInterruptionDialogs>> = {}) {
  const navigate = vi.fn();
  const reload = vi.fn();
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MantineProvider env="test">
          <PageEditorInterruptionDialogs
            interruption={null}
            reloadRequired={false}
            permissionRevokedDestination="/about"
            navigate={navigate}
            reload={reload}
            currentPath={() => '/about?edit=true&locale=ko#body'}
            {...props}
          />
        </MantineProvider>
      </NextIntlClientProvider>,
    );
  });
  act(() => {
    document.body.querySelector<HTMLButtonElement>('[role="alertdialog"] button')?.click();
  });
  return { navigate, reload };
}

describe('PageEditorInterruptionDialogs', () => {
  it('moves a revoked editor to the current published Page', () => {
    const { navigate } = renderDialogs({ interruption: 'permission_revoked' });
    expect(navigate).toHaveBeenCalledWith('/about');
  });

  it('preserves the exact editor URL when the session expires', () => {
    const { navigate } = renderDialogs({ interruption: 'session_expired' });
    expect(navigate).toHaveBeenCalledWith('/login?redirect=%2Fabout%3Fedit%3Dtrue%26locale%3Dko%23body');
  });

  it('prioritizes reload-required over an access interruption', () => {
    const { navigate, reload } = renderDialogs({
      interruption: 'permission_revoked',
      reloadRequired: true,
    });
    expect(reload).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });
});
