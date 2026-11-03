// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@/test/render';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArtistImageGalleryEditor, ArtistImageGalleryView } from './ArtistImageGalleryEditor';

const actions = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/lib/actions/artist', () => ({
  setArtistImagesAction: actions.save,
  setArtistImageAction: vi.fn(),
  deleteArtistAvatarAction: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

const images = [
  { fileId: 'one', url: null, sortOrder: 0, primary: true },
  { fileId: 'two', url: null, sortOrder: 1, primary: false },
];
const labels = {
  gallery: 'Gallery',
  makePrimary: 'Make primary',
  moveEarlier: 'Move earlier',
  moveLater: 'Move later',
  remove: 'Remove',
};

it('identifies image commands and prevents moving beyond either end', async () => {
  const onMove = vi.fn();
  const onRemove = vi.fn();
  const onMakePrimary = vi.fn();
  const { user } = render(
    <ArtistImageGalleryView
      images={images}
      saving={false}
      labels={labels}
      onMove={onMove}
      onRemove={onRemove}
      onMakePrimary={onMakePrimary}
    />,
  );
  const first = screen.getByRole('group', { name: 'Gallery 1' });
  const second = screen.getByRole('group', { name: 'Gallery 2' });
  expect(screen.getByText('Gallery')).toBeVisible();
  expect(within(first).getByRole('button', { name: 'Move earlier' })).toBeDisabled();
  expect(within(second).getByRole('button', { name: 'Move later' })).toBeDisabled();
  await user.click(within(second).getByRole('button', { name: 'Move earlier' }));
  expect(onMove).toHaveBeenCalledExactlyOnceWith(1, 0);
  await user.click(within(second).getByRole('button', { name: 'Make primary' }));
  expect(onMakePrimary).toHaveBeenCalledExactlyOnceWith('two');
  await user.click(within(first).getByRole('button', { name: 'Remove' }));
  expect(onRemove).toHaveBeenCalledExactlyOnceWith('one');
});

it('shows the saving command and prevents another image mutation', async () => {
  const onRemove = vi.fn();
  const { user } = render(
    <ArtistImageGalleryView
      images={images}
      saving
      pendingAction="remove:one"
      labels={labels}
      onMove={vi.fn()}
      onRemove={onRemove}
      onMakePrimary={vi.fn()}
    />,
  );
  const remove = within(screen.getByRole('group', { name: 'Gallery 1' })).getByRole('button', { name: 'Remove' });
  expect(remove).toHaveAttribute('aria-busy', 'true');
  await user.click(remove);
  expect(onRemove).not.toHaveBeenCalled();
  expect(
    within(screen.getByRole('group', { name: 'Gallery 2' })).getByRole('button', { name: 'Make primary' }),
  ).toBeDisabled();
});

it('locks the uploader during a gallery save and ignores its response after the artist target changes', async () => {
  let finish!: (result: unknown) => void;
  actions.save.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const client = new QueryClient();
  const fullLabels = { ...labels, image: 'Image', updateFailed: 'Could not save gallery' };
  const editor = (artistId: string, gallery = images) => (
    <QueryClientProvider client={client}>
      <ArtistImageGalleryEditor
        artistId={artistId}
        artistName="Artist"
        initialImages={gallery}
        initialRevision={artistId}
        inputId="gallery-file"
        labels={fullLabels}
      />
    </QueryClientProvider>
  );
  const { user, rerender } = render(editor('a'));
  await user.click(within(screen.getByRole('group', { name: 'Gallery 1' })).getByRole('button', { name: 'Remove' }));
  expect(
    within(screen.getByRole('group', { name: 'Gallery 1' })).getByRole('button', { name: 'Remove' }),
  ).toHaveAttribute('aria-busy', 'true');
  for (const trigger of screen.getAllByRole('button', { name: 'Upload Image' })) {
    expect(trigger).toBeDisabled();
  }
  rerender(editor('b', [images[1]]));
  await act(async () => finish({ ok: true, data: { images: [], revision: 'old' } }));
  expect(screen.getByRole('group', { name: 'Gallery 1' })).toBeVisible();
  for (const trigger of screen.getAllByRole('button', { name: 'Upload Image' })) {
    expect(trigger).toBeEnabled();
  }
  client.clear();
});

it('keeps one save in flight across same-artist refreshes and uses its returned images and revision', async () => {
  let finish!: (result: unknown) => void;
  actions.save.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  actions.save.mockResolvedValue({ data: { images: [], revision: 'revision-3' } });
  const client = new QueryClient();
  const fullLabels = { ...labels, image: 'Image', updateFailed: 'Could not save gallery' };
  const editor = (gallery = images, revision = 'revision-1') => (
    <QueryClientProvider client={client}>
      <ArtistImageGalleryEditor
        artistId="a"
        artistName="Artist"
        initialImages={gallery}
        initialRevision={revision}
        inputId="gallery-file"
        labels={fullLabels}
      />
    </QueryClientProvider>
  );
  const { user, rerender } = render(editor());
  try {
    const remove = within(screen.getByRole('group', { name: 'Gallery 1' })).getByRole('button', { name: 'Remove' });
    await user.click(remove);
    rerender(editor([...images], 'refreshed-revision'));
    expect(remove).toHaveAttribute('aria-busy', 'true');
    await user.click(within(screen.getByRole('group', { name: 'Gallery 2' })).getByRole('button', { name: 'Remove' }));
    expect(actions.save).toHaveBeenCalledTimes(1);
    await act(async () => finish({ data: { images: [images[1]], revision: 'revision-2' } }));
    expect(screen.queryByRole('group', { name: 'Gallery 2' })).not.toBeInTheDocument();
    rerender(editor([...images], 'refreshed-revision'));
    expect(screen.queryByRole('group', { name: 'Gallery 2' })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('group', { name: 'Gallery 1' })).getByRole('button', { name: 'Remove' }));
    expect(actions.save).toHaveBeenLastCalledWith('a', [], 'revision-2');
    expect(actions.save).toHaveBeenCalledTimes(2);
  } finally {
    client.clear();
  }
});

it.each(['response', 'rejection'] as const)(
  'adopts a same-artist refresh after a save fails by %s and uses it for the next command',
  async (failure) => {
    let finish!: (result: unknown) => void;
    let reject!: (error: Error) => void;
    actions.save.mockReturnValueOnce(
      new Promise((resolve, rejectSave) => {
        finish = resolve;
        reject = rejectSave;
      }),
    );
    actions.save.mockResolvedValue({ data: { images: [], revision: 'revision-3' } });
    const refreshedImages = [images[1], { fileId: 'three', url: null, sortOrder: 1, primary: false }];
    const client = new QueryClient();
    const fullLabels = { ...labels, image: 'Image', updateFailed: 'Could not save gallery' };
    const editor = (gallery = images, revision = 'revision-1') => (
      <QueryClientProvider client={client}>
        <ArtistImageGalleryEditor
          artistId="a"
          artistName="Artist"
          initialImages={gallery}
          initialRevision={revision}
          inputId="gallery-file"
          labels={fullLabels}
        />
      </QueryClientProvider>
    );
    const { user, rerender } = render(editor());
    try {
      const remove = within(screen.getByRole('group', { name: 'Gallery 1' })).getByRole('button', { name: 'Remove' });
      await user.click(remove);
      expect(actions.save).toHaveBeenCalledExactlyOnceWith('a', ['two'], 'revision-1');
      rerender(editor(refreshedImages, 'revision-2'));
      expect(remove).toHaveAttribute('aria-busy', 'true');
      await user.click(
        within(screen.getByRole('group', { name: 'Gallery 2' })).getByRole('button', { name: 'Remove' }),
      );
      expect(actions.save).toHaveBeenCalledTimes(1);
      await act(async () => {
        if (failure === 'response') {
          finish({ error: 'Could not save gallery' });
        } else {
          reject(new Error('Could not save gallery'));
        }
      });
      rerender(editor([...refreshedImages], 'revision-2'));
      const nextRemove = within(screen.getByRole('group', { name: 'Gallery 1' })).getByRole('button', {
        name: 'Remove',
      });
      expect(nextRemove).toBeEnabled();
      await user.click(nextRemove);
      expect(actions.save).toHaveBeenLastCalledWith('a', ['three'], 'revision-2');
      expect(actions.save).toHaveBeenCalledTimes(2);
    } finally {
      client.clear();
    }
  },
);
