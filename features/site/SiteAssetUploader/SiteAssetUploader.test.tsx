// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { SiteAssetUploader } from './SiteAssetUploader';

const actions = vi.hoisted(() => ({ upload: vi.fn(), set: vi.fn(), remove: vi.fn(), convert: vi.fn() }));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ uploadFile: actions.upload, isUploading: false }) }));
vi.mock('@/lib/actions/site-setting', () => ({
  setSiteAssetAction: actions.set,
  deleteSiteAssetAction: actions.remove,
}));
vi.mock('@/lib/utils/svg', () => ({ maybeConvertSvg: actions.convert }));
const clients: QueryClient[] = [];
beforeEach(() => {
  actions.upload.mockReset().mockResolvedValue({ fileId: 'file-1' });
  actions.set.mockReset().mockResolvedValue({ success: true, ogGenerationRunId: 'site-logo-run' });
  actions.remove.mockReset().mockResolvedValue({ success: true });
  actions.convert.mockReset().mockImplementation(async (file: File) => file);
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});
function setup(type: 'logo_full_light' | 'logo_email_dark' = 'logo_full_light', currentUrl: string | null = null) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  clients.push(client);
  const onSuccess = vi.fn();
  return {
    onSuccess,
    ...render(
      <QueryClientProvider client={client}>
        <SiteAssetUploader type={type} currentUrl={currentUrl} onSuccess={onSuccess} />
      </QueryClientProvider>,
    ),
  };
}
describe('SiteAssetUploader', () => {
  it('preserves ordinary SVG logos and forwards the automatic generation run', async () => {
    const file = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
    const { user, onSuccess } = setup();
    await user.upload(screen.getByLabelText('Full logo · light', { selector: 'input' }), file);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('site-logo-run'));
    expect(actions.convert).not.toHaveBeenCalled();
    expect(actions.upload).toHaveBeenCalledWith(file, { slotId: 'logo_full_light' });
    expect(actions.set).toHaveBeenCalledWith('logo_full_light', 'file-1');
  });
  it('converts email SVG logos before upload', async () => {
    const file = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
    const png = new File(['png'], 'logo.png', { type: 'image/png' });
    actions.convert.mockResolvedValue(png);
    const { user, onSuccess } = setup('logo_email_dark');
    await user.upload(screen.getByLabelText('Email logo · dark', { selector: 'input' }), file);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(actions.convert).toHaveBeenCalledWith(file);
    expect(actions.upload).toHaveBeenCalledWith(png, { slotId: 'logo_email_dark' });
    expect(actions.set).toHaveBeenCalledWith('logo_email_dark', 'file-1');
  });
  it('keeps the common upload pending surface until the file is linked', async () => {
    let finish!: (result: { success: boolean }) => void;
    actions.set.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onSuccess } = setup();
    await user.upload(
      screen.getByLabelText('Full logo · light', { selector: 'input' }),
      new File(['png'], 'logo.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(actions.set).toHaveBeenCalled());
    expect(screen.getByText('Loading...')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Full logo · light' })).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    await act(async () => finish({ success: true }));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { name: 'Full logo · light' })
          .every((button) => !button.hasAttribute('disabled')),
      ).toBe(true),
    );
  });
  it('prevents replacement while deletion is unresolved and recovers after failure', async () => {
    let finish!: (result: { error: string }) => void;
    actions.remove.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onSuccess } = setup('logo_full_light', '/logo.png');
    await user.click(screen.getByRole('button', { name: 'Remove Full logo · light' }));
    expect(
      screen.getAllByRole('button', { name: 'Full logo · light' }).every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    await user.upload(
      screen.getByLabelText('Full logo · light', { selector: 'input' }),
      new File(['png'], 'new.png', { type: 'image/png' }),
    );
    expect(actions.upload).not.toHaveBeenCalled();
    await act(async () => finish({ error: 'Cannot remove logo' }));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { name: 'Full logo · light' })
          .every((button) => !button.hasAttribute('disabled')),
      ).toBe(true),
    );
    expect(screen.getByRole('img', { name: 'Full logo · light' })).toHaveAttribute('src', '/logo.png');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
