// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Drawer } from './Drawer';

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

function renderDrawer(node: ReactNode) {
  act(() => {
    root.render(<MantineProvider env="test">{node}</MantineProvider>);
  });
}

function getDialog() {
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) {
    throw new Error('Expected a drawer dialog to be rendered.');
  }
  return dialog;
}

describe('Drawer', () => {
  it('uses the owning feature close label and emits close events', () => {
    const onClose = vi.fn();
    renderDrawer(
      <Drawer opened onClose={onClose} title="Filters" closeLabel="Close filters">
        Filter controls
      </Drawer>,
    );

    const dialog = getDialog();
    const closeButton = dialog.querySelector<HTMLButtonElement>('[aria-label="Close filters"]');

    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.textContent).toContain('Filter controls');
    expect(closeButton).not.toBeNull();

    act(() => closeButton?.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('maps semantic placement and size presets at the Core boundary', () => {
    renderDrawer(
      <Drawer
        opened
        onClose={vi.fn()}
        title="Navigation"
        closeLabel="Close navigation"
        placement="left"
        size="compact"
        visibility="mobile-only"
      >
        Navigation links
      </Drawer>,
    );

    const drawerRoot = document.body.querySelector<HTMLElement>('[data-placement="left"][data-size="compact"]');

    expect(drawerRoot).not.toBeNull();
    expect(drawerRoot?.className).toContain('mantine-hidden-from-sm');
  });

  it('locks close controls and marks the surface busy while loading', () => {
    const onClose = vi.fn();
    renderDrawer(
      <Drawer opened onClose={onClose} title="Saving" closeLabel="Close saving panel" loading>
        Saving changes
      </Drawer>,
    );

    const dialog = getDialog();
    const busyRoot = document.body.querySelector<HTMLElement>('[aria-busy="true"]');

    expect(dialog.querySelector('[aria-label="Close saving panel"]')).toBeNull();
    expect(busyRoot?.getAttribute('data-close-policy')).toBe('non-dismissible');

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('supports a non-dismissible policy without implying loading state', () => {
    renderDrawer(
      <Drawer
        opened
        onClose={vi.fn()}
        title="Required action"
        closeLabel="Close required action"
        closePolicy="non-dismissible"
      >
        Complete the action to continue.
      </Drawer>,
    );

    const dialog = getDialog();
    const drawerRoot = document.body.querySelector<HTMLElement>('[data-close-policy="non-dismissible"]');

    expect(dialog.querySelector('[aria-label="Close required action"]')).toBeNull();
    expect(drawerRoot?.hasAttribute('data-loading')).toBe(false);
  });
});
