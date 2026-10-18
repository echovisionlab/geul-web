// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@/test/render';
import type { SiteLoaderAsset } from '@/lib/types/site-setting/config';
import { SiteLoaderAssetsUploader } from './SiteLoaderAssetsUploader';

const uploadFileMock = vi.fn();
const addSiteLoaderAssetActionMock = vi.fn();
const removeSiteLoaderAssetActionMock = vi.fn();

vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({ uploadFile: uploadFileMock, isUploading: false }),
}));

vi.mock('@/lib/actions/site-setting', () => ({
  addSiteLoaderAssetAction: (...args: unknown[]) => addSiteLoaderAssetActionMock(...args),
  removeSiteLoaderAssetAction: (...args: unknown[]) => removeSiteLoaderAssetActionMock(...args),
}));

function renderUploader(assets: SiteLoaderAsset[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SiteLoaderAssetsUploader assets={assets} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  uploadFileMock.mockReset().mockResolvedValue({ fileId: 'file-1', url: '/media/site/loader/file-1.gif' });
  addSiteLoaderAssetActionMock.mockReset().mockResolvedValue({ success: true });
  removeSiteLoaderAssetActionMock.mockReset().mockResolvedValue({ success: true });
});

describe('SiteLoaderAssetsUploader', () => {
  it('uploads a selected GIF to the loader slot and adds the returned file to the loader pool', async () => {
    const { user } = renderUploader([]);
    const file = new File(['gif'], 'loader.gif', { type: 'image/gif' });

    await user.upload(screen.getByLabelText('Site Loader', { selector: 'input' }), file);

    await waitFor(() => expect(addSiteLoaderAssetActionMock).toHaveBeenCalledWith('file-1'));
    expect(uploadFileMock).toHaveBeenCalledWith(file, { slotId: 'loader' });
  });

  it('removes an existing loader asset by its file id', async () => {
    const { user } = renderUploader([
      { file_id: 'file-2', url: 'https://cdn.example.com/media/site/loader/file-2.gif' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Remove Site Loader 1' }));

    await waitFor(() => expect(removeSiteLoaderAssetActionMock).toHaveBeenCalledWith('file-2'));
    expect(addSiteLoaderAssetActionMock).not.toHaveBeenCalled();
  });
});
