// @vitest-environment jsdom
// This domain-free indicator is covered at the Core boundary.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { CollabSyncStatusIndicator } from './CollabSyncStatusIndicator';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('CollabSyncStatusIndicator', () => {
  it('renders offline state with tooltip enabled by default', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <MantineProvider>
          <CollabSyncStatusIndicator isConnected={false} isSynced={false} label="Offline" />
        </MantineProvider>,
      );
    });

    const indicator = document.querySelector('[data-collab-status="offline"]');

    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute('aria-label')).toBe('Offline');
  });

  it('renders syncing state without a tooltip wrapper when disabled', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <MantineProvider>
          <CollabSyncStatusIndicator isConnected isSynced={false} label="Syncing..." withTooltip={false} size={20} />
        </MantineProvider>,
      );
    });

    const indicator = document.querySelector('[data-collab-status="syncing"]');

    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute('aria-label')).toBe('Syncing...');
  });
});
