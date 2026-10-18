// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import { SiteOgBackgroundUploader } from './SiteOgBackgroundUploader';

const actions = vi.hoisted(() => ({ upload: vi.fn(), setAsset: vi.fn(), deleteAsset: vi.fn() }));

// Supply the crop result at the browser image-decoding boundary.
vi.mock('@/features/upload/ImageUploadCropController', () => ({
  ImageUploadCropController: ({
    imageUrl,
    onUpload,
    onRemove,
  }: {
    imageUrl: string | null;
    onUpload: (blob: Blob) => void;
    onRemove: () => void;
  }) => (
    <>
      <output aria-label="Background source">{imageUrl ?? ''}</output>
      <button type="button" onClick={() => onUpload(new Blob(['image'], { type: 'image/webp' }))}>
        Use cropped image
      </button>
      <button type="button" onClick={onRemove}>
        Remove image
      </button>
    </>
  ),
}));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload: actions.upload, isUploading: false }) }));
vi.mock('@/lib/actions/site-setting', () => ({
  setSiteAssetAction: actions.setAsset,
  deleteSiteAssetAction: actions.deleteAsset,
}));

const clients: QueryClient[] = [];
beforeEach(() => {
  actions.upload.mockReset().mockResolvedValue({ fileId: 'file-1', url: '/uploaded-source.webp' });
  actions.setAsset.mockReset().mockResolvedValue({ success: true });
  actions.deleteAsset.mockReset().mockResolvedValue({ success: true, assetUrl: null });
});
afterEach(() => {
  for (const client of clients.splice(0)) {
    client.clear();
  }
});

function renderUploader(props: Parameters<typeof SiteOgBackgroundUploader>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <SiteOgBackgroundUploader {...props} />
    </QueryClientProvider>,
  );
}

describe('SiteOgBackgroundUploader', () => {
  it('refreshes the owning settings projection after upload succeeds', async () => {
    const onSuccess = vi.fn();
    const { user } = renderUploader({ type: 'privacy_og_background', currentUrl: null, onSuccess });
    await user.click(screen.getByRole('button', { name: 'Use cropped image' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(undefined));
    expect(actions.upload).toHaveBeenCalledWith(expect.any(Blob), {
      slotId: 'privacy_og_background',
      fileName: 'privacy_og_background',
      onProgress: expect.any(Function),
    });
    expect(actions.setAsset).toHaveBeenCalledWith('privacy_og_background', 'file-1');
    expect(screen.getByRole('status', { name: 'Background source' })).not.toHaveTextContent('/uploaded-source.webp');
  });

  it('clears the current background after delete succeeds', async () => {
    const { user } = renderUploader({ type: 'terms_og_background', currentUrl: '/existing-og-background.webp' });
    expect(screen.getByRole('status', { name: 'Background source' })).toHaveTextContent('/existing-og-background.webp');
    await user.click(screen.getByRole('button', { name: 'Remove image' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Background source' })).toBeEmptyDOMElement());
    expect(actions.deleteAsset).toHaveBeenCalledWith('terms_og_background');
  });
});
