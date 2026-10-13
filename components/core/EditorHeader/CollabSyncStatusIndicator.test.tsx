// @vitest-environment jsdom
// This domain-free indicator is covered at the Core boundary.

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CollabSyncStatusIndicator, type CollabSyncStatusIndicatorProps } from './CollabSyncStatusIndicator';

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
        <DesignSystemProvider>
          <CollabSyncStatusIndicator isConnected={false} isSynced={false} label="Offline" />
        </DesignSystemProvider>,
      );
    });

    const indicator = document.querySelector('[data-collab-status="offline"]');

    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute('aria-label')).toBe('Offline');
    expect(indicator?.getAttribute('role')).toBe('img');
  });

  it('renders syncing state without a tooltip wrapper when disabled', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <DesignSystemProvider>
          <CollabSyncStatusIndicator isConnected isSynced={false} label="Syncing..." withTooltip={false} />
        </DesignSystemProvider>,
      );
    });

    const indicator = document.querySelector('[data-collab-status="syncing"]');

    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute('aria-label')).toBe('Syncing...');
  });

  it('rejects runtime dimensions from untyped consumers', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const props = { isConnected: true, isSynced: true, label: 'Synced', size: 20 };
    expect(() =>
      act(() => root?.render(<CollabSyncStatusIndicator {...(props as CollabSyncStatusIndicatorProps)} />)),
    ).toThrow('Collaboration indicator size is owned by Core');
  });
});
