// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEditorWriteOrigin,
  hasAdoptedConfigurationOrigin,
  registerConfigurationOriginWrite,
} from '@/lib/editor/editor-write-origin';
import { ReleaseArtworkUploader } from './ReleaseArtworkUploader';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  setArtwork: vi.fn(),
  deleteArtwork: vi.fn(),
}));
let view: { onUpload: (blob: Blob) => Promise<void>; onRemove: () => void };
vi.mock('./ReleaseArtworkView', () => ({
  ReleaseArtworkView: (props: typeof view) => {
    view = props;
    return null;
  },
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@/lib/utils/client-logger', () => ({ createClientLogger: () => ({ error: vi.fn() }) }));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload: mocks.upload, isUploading: false }) }));
vi.mock('@/lib/actions/release', () => ({
  setReleaseArtworkAction: mocks.setArtwork,
  deleteReleaseArtworkAction: mocks.deleteArtwork,
}));

let root: Root;
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ fileId: 'file-1' });
  mocks.setArtwork.mockResolvedValue({ ok: true, url: 'https://cdn.example/artwork.webp' });
  mocks.deleteArtwork.mockResolvedValue({ ok: true, success: true });
  root = createRoot(document.createElement('div'));
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
});
afterEach(() => {
  act(() => root.unmount());
  client.clear();
});

function render(releaseId: string) {
  const onArtworkChange = vi.fn();
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <ReleaseArtworkUploader releaseId={releaseId} artworkUrl={null} onArtworkChange={onArtworkChange} />
      </QueryClientProvider>,
    ),
  );
  return onArtworkChange;
}

describe('Release artwork configuration origin', () => {
  it('forwards an origin for attachment and conservatively invalidates earlier canonical proof', async () => {
    const releaseId = 'release-artwork-attach-origin';
    const owner = Symbol('canonical-owner');
    registerConfigurationOriginWrite(`release:${releaseId}`, owner)(true);
    const origin = getEditorWriteOrigin();
    expect(hasAdoptedConfigurationOrigin(`release:${releaseId}`, owner, origin)).toBe(true);
    const onArtworkChange = render(releaseId);

    await act(async () => view.onUpload(new Blob(['artwork'])));

    expect(mocks.setArtwork).toHaveBeenCalledExactlyOnceWith(releaseId, 'file-1', origin);
    expect(onArtworkChange).toHaveBeenCalledExactlyOnceWith('https://cdn.example/artwork.webp');
    expect(hasAdoptedConfigurationOrigin(`release:${releaseId}`, owner, origin)).toBe(false);
  });

  it('forwards an origin for artwork removal', async () => {
    const releaseId = 'release-artwork-remove-origin';
    const onArtworkChange = render(releaseId);
    await act(async () => {
      view.onRemove();
      await vi.waitFor(() => expect(mocks.deleteArtwork).toHaveBeenCalled());
    });
    expect(mocks.deleteArtwork).toHaveBeenCalledExactlyOnceWith(releaseId, getEditorWriteOrigin());
    expect(onArtworkChange).toHaveBeenCalledExactlyOnceWith(null);
  });
});
