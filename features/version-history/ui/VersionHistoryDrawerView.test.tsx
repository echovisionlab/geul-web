// @vitest-environment jsdom

import { DesignSystemTestProvider as DesignSystemProvider } from '@/test/TestProviders';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  VersionHistoryDrawerView,
  type VersionHistoryDrawerViewLabels,
  type VersionHistoryDrawerViewProps,
} from './VersionHistoryDrawerView';

const labels: VersionHistoryDrawerViewLabels = {
  title: 'Version history',
  close: 'Close',
  loading: 'Loading...',
  empty: 'No versions yet',
  restore: 'Restore',
  restoreTitle: 'Restore version',
  restoreBody: 'Restoring to v2 will replace the current state. Continue?',
  cancel: 'Cancel',
  loadMore: 'Continue',
  loadFailed: 'Could not load version history.',
  end: 'All versions loaded.',
  retry: 'Try again',
};

const versions = [
  {
    id: 'version-2',
    version: 2,
    versionLabel: 'v2',
    title: 'Edited title',
    sourceLocaleLabel: 'Locale: en',
    createdAt: '2026-07-20T10:00:00Z',
    createdAtLabel: '2 minutes ago',
    createdAtTooltip: 'July 20, 2026 at 10:00',
    contributorLabel: 'by Mina and user-2',
  },
];

let container: HTMLDivElement;
let root: Root;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderView(overrides: Partial<VersionHistoryDrawerViewProps> = {}) {
  const props: VersionHistoryDrawerViewProps = {
    opened: true,
    onClose: vi.fn(),
    versions,
    labels,
    loading: false,
    error: null,
    onRetry: vi.fn(async () => {}),
    pagination: { contextKey: 'work:one', nextPage: null, loading: false, error: null, onLoad: vi.fn(async () => {}) },
    restoring: false,
    canRestore: true,
    selectedVersionId: null,
    restoreConfirmationOpened: false,
    onSelectVersion: vi.fn(),
    onCloseRestoreConfirmation: vi.fn(),
    onRestore: vi.fn(),
    ...overrides,
  };

  act(() => {
    root.render(
      <DesignSystemProvider forceColorScheme="light">
        <VersionHistoryDrawerView {...props} />
      </DesignSystemProvider>,
    );
  });

  return props;
}

function getButtonByText(rootElement: ParentNode, label: string) {
  const button = [...rootElement.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) {
    throw new Error(`Expected a button labeled "${label}".`);
  }
  return button;
}

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
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('VersionHistoryDrawerView', () => {
  it('renders supplied view models and emits selection intent', () => {
    const props = renderView();

    expect(document.body.textContent).toContain('Version history');
    expect(document.body.textContent).toContain('Edited title');
    expect(document.body.textContent).toContain('Locale: en');
    expect(document.body.textContent).toContain('2 minutes ago');
    expect(document.body.textContent).toContain('by Mina and user-2');
    const restore = getButtonByText(document.body, 'Restore');
    expect(restore.textContent).toBe('Restore');
    const describedBy = restore.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'v2',
      'Edited title',
      'Locale: en',
      'July 20, 2026 at 10:00',
    ]);
    const row = document.body.querySelector('[role="listitem"]');
    expect(row).toHaveAccessibleName('Edited title v2');
    const timestamp = row!.querySelector('time')!;
    expect(timestamp).toHaveAttribute('datetime', versions[0]!.createdAt);
    expect(timestamp).toHaveAccessibleDescription(versions[0]!.createdAtTooltip);
    expect(timestamp.hasAttribute('tabindex')).toBe(false);

    act(() => getButtonByText(document.body, 'Restore').click());

    expect(props.onSelectVersion).toHaveBeenCalledWith('version-2');
  });

  it('renders loading and delegates restore confirmation actions to callbacks', () => {
    const onRestore = vi.fn();
    const onCloseRestoreConfirmation = vi.fn();
    renderView({
      selectedVersionId: 'version-2',
      restoreConfirmationOpened: true,
      onRestore,
      onCloseRestoreConfirmation,
    });

    const confirmation = [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')].find((dialog) =>
      dialog.textContent?.includes('Restoring to v2 will replace the current state. Continue?'),
    );
    if (!confirmation) {
      throw new Error('Expected the restore confirmation dialog.');
    }

    act(() => getButtonByText(confirmation, 'Restore').click());
    act(() => getButtonByText(confirmation, 'Cancel').click());

    expect(onRestore).toHaveBeenCalledOnce();
    expect(onCloseRestoreConfirmation).toHaveBeenCalledOnce();
  });

  it('uses the supplied loading label without exposing version rows', () => {
    renderView({ loading: true });

    expect(document.body.querySelector('[aria-label="Loading..."]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Edited title');
  });

  it('keeps history visible while restore is disabled', () => {
    const props = renderView({ canRestore: false });
    const restoreButton = getButtonByText(document.body, 'Restore');

    expect(document.body.textContent).toContain('Edited title');
    expect(restoreButton.disabled).toBe(true);
    act(() => restoreButton.click());
    expect(props.onSelectVersion).not.toHaveBeenCalled();
  });

  it('reports an initial list failure with explicit retry instead of an empty history', async () => {
    const onRetry = vi.fn(async () => {});
    renderView({ versions: [], error: labels.loadFailed, onRetry });
    expect(document.body.querySelector('[role="alert"]')).toHaveTextContent(labels.loadFailed);
    expect(document.body.textContent).not.toContain(labels.empty);
    await act(async () => getButtonByText(document.body, labels.retry).click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('keeps earlier rows on a page failure and delegates a bounded retry to the same page', async () => {
    const onLoad = vi.fn(async () => {});
    renderView({
      error: labels.loadFailed,
      pagination: { contextKey: 'work:one', nextPage: 2, loading: false, error: labels.loadFailed, onLoad },
    });
    expect(document.body.querySelector('[role="listitem"]')).toHaveTextContent('Edited title');
    expect(document.body.querySelector('[data-near-end-loader] [role="alert"]')).toHaveTextContent(labels.loadFailed);
    await act(async () => getButtonByText(document.body, labels.retry).click());
    expect(onLoad).toHaveBeenCalledOnce();
  });
});
