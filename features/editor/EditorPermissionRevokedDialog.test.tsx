// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '@/messages/en.json';
import { EditorPermissionRevokedDialog } from './EditorPermissionRevokedDialog';

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

function renderDialog(onConfirm = vi.fn(), loading = false) {
  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DesignSystemProvider locale="en" forceColorScheme="light">
          <EditorPermissionRevokedDialog opened onConfirm={onConfirm} loading={loading} />
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    );
  });

  return onConfirm;
}

describe('EditorPermissionRevokedDialog', () => {
  it('renders the shared localized blocking alert and confirms once', () => {
    const onConfirm = renderDialog();
    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    // The shared modal must enforce the isolation declared to assistive technology.
    expect(container?.getAttribute('aria-hidden') === 'true' || container?.inert === true).toBe(true);
    expect(dialog?.closest('[aria-hidden="true"], [inert]')).toBeNull();
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog?.getAttribute('aria-describedby')).toBeTruthy();
    expect(dialog?.closest<HTMLElement>('[data-level]')?.dataset.level).toBe('warning');
    expect(dialog?.textContent).toContain('Editing permission revoked');
    expect(dialog?.querySelectorAll('button')).toHaveLength(1);
    const confirm = dialog?.querySelector<HTMLButtonElement>('button');
    expect(confirm?.dataset.tone).toBe('warning');
    expect(confirm?.dataset.emphasis).toBe('strong');
    expect(dialog?.contains(document.activeElement)).toBe(true);
    expect(document.getElementById(dialog!.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Editing permission revoked',
    );
    expect(document.getElementById(dialog!.getAttribute('aria-describedby')!)?.textContent).toBe(
      enMessages.editorCommon.permissionRevoked.message,
    );

    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.body.querySelector('[role="alertdialog"]')).toBe(dialog);
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => {
      dialog?.querySelector<HTMLButtonElement>('button')?.click();
    });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not expose a close path and keeps the action disabled while navigating', () => {
    renderDialog(vi.fn(), true);
    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
    const button = dialog?.querySelector<HTMLButtonElement>('button');

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog?.querySelector('[aria-label*="lose"]')).toBeNull();
    expect(button?.disabled).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.body.querySelector('[role="alertdialog"]')).not.toBeNull();
  });
});
