// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import { SiteAssetUploader } from './SiteAssetUploader';

// The real dropzone, selection policy and validation run; only the upload transport and actions are replaced.
const uploadFileMock = vi.fn();
const setSiteAssetActionMock = vi.fn();

vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({ uploadFile: uploadFileMock, isUploading: false }),
}));

vi.mock('@/lib/actions/site-setting', () => ({
  setSiteAssetAction: (...args: unknown[]) => setSiteAssetActionMock(...args),
  deleteSiteAssetAction: vi.fn(),
}));

function renderFaviconUploader() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SiteAssetUploader type="favicon" currentUrl={null} />
    </QueryClientProvider>,
  );
}

function faviconInput() {
  return screen.getByLabelText('Site Favicon', { selector: 'input' }) as HTMLInputElement;
}

beforeEach(() => {
  uploadFileMock.mockReset().mockResolvedValue({ fileId: 'file-1', url: '/media/favicon.ico' });
  setSiteAssetActionMock.mockReset().mockResolvedValue({ success: true });
});

describe('SiteAssetUploader favicon slot', () => {
  it('offers PNG, SVG and ICO (with both ICO MIME aliases and the .ico extension) in the file picker', () => {
    renderFaviconUploader();

    const accepted = faviconInput().accept.split(',');
    expect(accepted).toEqual(
      expect.arrayContaining(['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', '.ico']),
    );
  });

  it.each([
    { name: 'an .ico file the browser reports without a MIME type', type: '' },
    { name: 'the image/vnd.microsoft.icon alias', type: 'image/vnd.microsoft.icon' },
  ])('uploads $name to the favicon slot', async ({ type }) => {
    const { user } = renderFaviconUploader();
    const file = new File(['ico'], 'favicon.ico', { type });

    await user.upload(faviconInput(), file);

    await waitFor(() => expect(uploadFileMock).toHaveBeenCalledWith(file, { slotId: 'favicon' }));
    await waitFor(() => expect(setSiteAssetActionMock).toHaveBeenCalledWith('favicon', 'file-1'));
  });
});
