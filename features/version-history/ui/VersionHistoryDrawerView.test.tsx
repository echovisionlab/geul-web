// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import { PageLoaderView } from '@/components/core/LoadingSurface';
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

function renderView(overrides: Partial<VersionHistoryDrawerViewProps> = {}) {
  const props: VersionHistoryDrawerViewProps = {
    opened: true,
    onClose: vi.fn(),
    versions,
    labels,
    loading: false,
    loadingSurface: <PageLoaderView placement="flow" imageAlt={labels.loading} message={labels.loading} />,
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
  return { ...render(<VersionHistoryDrawerView {...props} />), props };
}

describe('VersionHistoryDrawerView', () => {
  it('renders named version rows, timestamps and selection intent', async () => {
    const { props, user } = renderView();
    const row = screen.getByRole('listitem', { name: 'Edited title v2' });
    expect(row).toHaveTextContent('Locale: en');
    expect(row).toHaveTextContent('by Mina and user-2');
    const timestamp = within(row).getByText('2 minutes ago');
    expect(timestamp).toHaveAttribute('datetime', versions[0]!.createdAt);
    expect(timestamp).toHaveAccessibleDescription(versions[0]!.createdAtTooltip);
    expect(timestamp).not.toHaveAttribute('tabindex');
    const restore = within(row).getByRole('button', { name: 'Restore' });
    expect(restore).toHaveAccessibleDescription('v2 Edited title Locale: en July 20, 2026 at 10:00');
    await user.click(restore);
    expect(props.onSelectVersion).toHaveBeenCalledWith('version-2');
  });

  it('delegates confirmation and cancellation to the supplied callbacks', async () => {
    const { props, user, rerender } = renderView();
    await user.click(screen.getByRole('button', { name: labels.restore }));
    rerender(<VersionHistoryDrawerView {...props} selectedVersionId="version-2" restoreConfirmationOpened />);
    const confirmation = await screen.findByRole('dialog', { name: labels.restoreTitle });
    expect(confirmation).toHaveTextContent(labels.restoreBody);
    await user.click(within(confirmation).getByRole('button', { name: 'Restore' }));
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(props.onRestore).toHaveBeenCalledOnce();
    expect(props.onCloseRestoreConfirmation).toHaveBeenCalledOnce();
  });

  it('shows the shared loading surface without stale rows or empty history', () => {
    renderView({ loading: true });
    expect(screen.getByRole('status', { name: labels.loading })).toHaveTextContent(labels.loading);
    expect(screen.queryByText('Edited title')).not.toBeInTheDocument();
    expect(screen.queryByText(labels.empty)).not.toBeInTheDocument();
  });

  it('keeps history readable when restore is disabled', async () => {
    const { props, user } = renderView({ canRestore: false });
    const restore = screen.getByRole('button', { name: 'Restore' });
    expect(screen.getByText('Edited title')).toBeVisible();
    expect(restore).toBeDisabled();
    await user.click(restore);
    expect(props.onSelectVersion).not.toHaveBeenCalled();
  });

  it('distinguishes initial failure from empty and shows pending retry', async () => {
    const { props, user, rerender } = renderView({ versions: [], error: labels.loadFailed });
    expect(screen.getByRole('alert')).toHaveTextContent(labels.loadFailed);
    expect(screen.queryByText(labels.empty)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: labels.retry }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    rerender(<VersionHistoryDrawerView {...props} retrying />);
    expect(screen.getByRole('button', { name: labels.retry })).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: labels.retry }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('keeps earlier rows on continuation failure and retries the same page', async () => {
    const onLoad = vi.fn(async () => {});
    const { user } = renderView({
      error: labels.loadFailed,
      pagination: { contextKey: 'work:one', nextPage: 2, loading: false, error: labels.loadFailed, onLoad },
    });
    expect(screen.getByRole('listitem')).toHaveTextContent('Edited title');
    expect(screen.getByRole('alert')).toHaveTextContent(labels.loadFailed);
    await user.click(screen.getByRole('button', { name: labels.retry }));
    expect(onLoad).toHaveBeenCalledOnce();
  });
});
