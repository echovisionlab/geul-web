// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { PageLoader } from '@/features/site/PageLoader';
import { ArtistDeleteDialogView } from './ArtistDeleteDialogView';

const labels = {
  title: 'Delete artist',
  confirm: 'Delete',
  cancel: 'Cancel',
  close: 'Close',
  loading: 'Loading relations…',
  failed: 'Failed',
  confirmation: 'Delete {name}?',
  relationSummary: '{count} related items will be unlinked.',
};
const preview = {
  revision: 'revision-1',
  totalRelationCount: 3,
  impacts: [
    { domain: 2, entityId: 'label-1', label: 'Example Label', relationCount: 1 },
    { domain: 4, entityId: 'release-1', label: 'Example Release', relationCount: 2 },
  ],
};
it('renders exact impacts and emits confirmation', async () => {
  const confirm = vi.fn();
  const { user } = render(
    <ArtistDeleteDialogView
      opened
      artistName="Example Artist"
      previewLoading={false}
      loadingSurface={<PageLoader placement="flow" message={labels.loading} />}
      deleting={false}
      previewError={null}
      preview={preview}
      labels={labels}
      onClose={vi.fn()}
      onConfirm={confirm}
    />,
  );
  expect(await screen.findByRole('link', { name: 'Example Label (1)' })).toHaveAttribute('href', '/labels/label-1');
  expect(screen.getByRole('link', { name: 'Example Release (2)' })).toHaveAttribute('href', '/releases/release-1');
  expect(screen.getByText('3 related items will be unlinked.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(confirm).toHaveBeenCalledOnce();
});
it('shows the shared impact lookup wait and disallows deletion until the preview resolves', async () => {
  const props = {
    opened: true,
    artistName: 'Example Artist',
    previewLoading: true,
    loadingSurface: <PageLoader placement="flow" message={labels.loading} />,
    deleting: false,
    preview: null,
    labels,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };
  const { rerender } = render(<ArtistDeleteDialogView {...props} />);
  expect(await screen.findByRole('status')).toHaveTextContent(labels.loading);
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  rerender(<ArtistDeleteDialogView {...props} previewLoading={false} preview={preview} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
});
