// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import type { previewDeleteArtistAction, deleteArtistAction } from '@/lib/actions/artist';
import { ArtistDeleteDialog } from './ArtistDeleteDialog';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const preview = (revision: string, totalRelationCount = 0) => ({
  ok: true as const,
  data: { revision, totalRelationCount, impacts: [] },
});

it('ends preview loading on rejection and keeps deletion disabled', async () => {
  const pending = deferred<Awaited<ReturnType<typeof previewDeleteArtistAction>>>();
  const previewAction = vi.fn<typeof previewDeleteArtistAction>(() => pending.promise);
  render(
    <ArtistDeleteDialog
      artist={{ id: 'a', name: 'Artist A' }}
      onClose={vi.fn()}
      onDeleted={vi.fn()}
      previewAction={previewAction}
    />,
  );
  expect(screen.getByText('Loading...')).toBeVisible();
  await act(async () => pending.reject(new Error('offline')));
  expect(await screen.findByText('Failed to load data.')).toBeVisible();
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
});

it('ignores the previous target conflict refresh after a different artist is selected', async () => {
  const refresh = deferred<Awaited<ReturnType<typeof previewDeleteArtistAction>>>();
  const previewAction = vi
    .fn<typeof previewDeleteArtistAction>()
    .mockResolvedValueOnce(preview('a'))
    .mockReturnValueOnce(refresh.promise)
    .mockResolvedValueOnce(preview('b', 7));
  const deleteAction = vi
    .fn<typeof deleteArtistAction>()
    .mockResolvedValue({ ok: false, error: 'Changed', errorCode: 'ACTION_FAILED' });
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  const props = { onClose, onDeleted, previewAction, deleteAction };
  const { user, rerender } = render(<ArtistDeleteDialog {...props} artist={{ id: 'a', name: 'Artist A' }} />);
  await screen.findByText('0 related items will be unlinked.');
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2));
  rerender(<ArtistDeleteDialog {...props} artist={{ id: 'b', name: 'Artist B' }} />);
  expect(await screen.findByText('7 related items will be unlinked.')).toBeVisible();
  await act(async () => refresh.resolve(preview('obsolete', 99)));
  expect(screen.queryByText('99 related items will be unlinked.')).not.toBeInTheDocument();
  expect(screen.getByText('7 related items will be unlinked.')).toBeVisible();
  expect(onDeleted).not.toHaveBeenCalled();
});
