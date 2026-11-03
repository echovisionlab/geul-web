// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@/test/render';
import { SiteOgBackgroundUploader } from './SiteOgBackgroundUploader';
const actions = vi.hoisted(() => ({ upload: vi.fn(), setAsset: vi.fn(), deleteAsset: vi.fn() }));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload: actions.upload, isUploading: false }) }));
vi.mock('@/lib/actions/site-setting', () => ({
  setSiteAssetAction: actions.setAsset,
  deleteSiteAssetAction: actions.deleteAsset,
}));
vi.mock('@/lib/utils/upload-pipeline', () => ({ prepareImageFileForPreview: async (file: File) => file }));
const clients: QueryClient[] = [];
beforeEach(() => {
  actions.upload.mockReset().mockResolvedValue({ fileId: 'file-1', url: '/uploaded-source.webp' });
  actions.setAsset.mockReset().mockResolvedValue({ success: true });
  actions.deleteAsset.mockReset().mockResolvedValue({ success: true, assetUrl: null });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) =>
    callback(new Blob(['encoded'], { type })),
  );
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});
function setup(props: Parameters<typeof SiteOgBackgroundUploader>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <SiteOgBackgroundUploader {...props} />
    </QueryClientProvider>,
  );
}
async function crop(user: ReturnType<typeof render>['user']) {
  await user.upload(
    screen.getByLabelText('Upload Privacy OG Background', { selector: 'input' }),
    new File(['png'], 'background.png', { type: 'image/png' }),
  );
  const dialog = await screen.findByRole('dialog', { name: 'Crop Featured Image' });
  const image = within(dialog).getByRole('img', { name: 'Privacy OG Background' });
  Object.defineProperties(image, {
    naturalWidth: { value: 1600 },
    naturalHeight: { value: 900 },
    width: { value: 800 },
    height: { value: 450 },
  });
  fireEvent.load(image);
  await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
}
describe('SiteOgBackgroundUploader', () => {
  it('refreshes the settings projection only after the uploaded file is linked', async () => {
    let finish!: (result: { success: boolean }) => void;
    actions.setAsset.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onSuccess = vi.fn();
    const { user } = setup({ type: 'privacy_og_background', currentUrl: null, onSuccess });
    await crop(user);
    await waitFor(() => expect(actions.setAsset).toHaveBeenCalledWith('privacy_og_background', 'file-1'));
    expect(actions.upload).toHaveBeenCalledWith(expect.any(Blob), {
      slotId: 'privacy_og_background',
      fileName: 'privacy_og_background',
      onProgress: expect.any(Function),
    });
    expect(screen.getByRole('progressbar', { name: 'Saving…' })).toBeInTheDocument();
    expect(screen.queryByText('Preparing image')).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: 'Featured image' })).not.toBeInTheDocument();
    await act(async () => finish({ success: true }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(undefined));
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  });
  it('keeps the image while deletion is pending and clears it after success', async () => {
    let finish!: (result: { success: boolean }) => void;
    actions.deleteAsset.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = setup({ type: 'terms_og_background', currentUrl: '/existing-og-background.webp' });
    expect(screen.getByRole('img', { name: 'Featured image' })).toHaveAttribute('src', '/existing-og-background.webp');
    await user.click(screen.getByRole('button', { name: 'Remove featured image' }));
    expect(screen.getByRole('button', { name: 'Remove featured image' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('img', { name: 'Featured image' })).toBeInTheDocument();
    await act(async () => finish({ success: true }));
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Featured image' })).not.toBeInTheDocument());
    expect(actions.deleteAsset).toHaveBeenCalledWith('terms_og_background');
  });
});
