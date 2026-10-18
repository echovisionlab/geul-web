import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAdminClient,
  createFileClient,
  createManifestClient,
  createPublicPrivacyClientWithAuth,
  createPublicTermsClientWithAuth,
  createSiteSettingClient,
} from '@/lib/api/server-client';
import {
  deleteSiteAssetAction,
  regenerateLegalOgImageAction,
  regenerateSiteOgImageAction,
  setSiteAssetAction,
  updateSiteSettingsAction,
} from './site-setting';

const getSettingMock = vi.fn();
const setSettingMock = vi.fn();
const setManySettingsMock = vi.fn();
const addSiteLoaderAssetMock = vi.fn();
const removeSiteLoaderAssetMock = vi.fn();
const manifestGetMock = vi.fn();
const regenerateOgImageMock = vi.fn();
const regenerateAllOgImagesMock = vi.fn();
const privacyGetMock = vi.fn();
const termsGetMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createAdminClient: vi.fn(),
  createFileClient: vi.fn(),
  createManifestClient: vi.fn(),
  createSiteSettingClient: vi.fn(),
  createPublicPrivacyClientWithAuth: vi.fn(),
  createPublicTermsClientWithAuth: vi.fn(),
}));

beforeEach(() => {
  getSettingMock.mockReset();
  setSettingMock.mockReset();
  setManySettingsMock.mockReset();
  addSiteLoaderAssetMock.mockReset();
  removeSiteLoaderAssetMock.mockReset();
  manifestGetMock.mockReset();
  regenerateOgImageMock.mockReset();
  regenerateAllOgImagesMock.mockReset();
  privacyGetMock.mockReset();
  termsGetMock.mockReset();

  vi.mocked(createSiteSettingClient).mockReset();
  vi.mocked(createFileClient).mockReset();
  vi.mocked(createManifestClient).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(createPublicPrivacyClientWithAuth).mockReset();
  vi.mocked(createPublicTermsClientWithAuth).mockReset();
  vi.mocked(revalidatePath).mockClear();

  vi.mocked(createSiteSettingClient).mockResolvedValue({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
    setManySettings: setManySettingsMock,
    addSiteLoaderAsset: addSiteLoaderAssetMock,
    removeSiteLoaderAsset: removeSiteLoaderAssetMock,
  } as unknown as Awaited<ReturnType<typeof createSiteSettingClient>>);
  vi.mocked(createManifestClient).mockResolvedValue({
    get: manifestGetMock,
  } as unknown as Awaited<ReturnType<typeof createManifestClient>>);
  vi.mocked(createAdminClient).mockResolvedValue({
    regenerateOgImage: regenerateOgImageMock,
    regenerateAllOgImages: regenerateAllOgImagesMock,
  } as unknown as Awaited<ReturnType<typeof createAdminClient>>);
  vi.mocked(createPublicPrivacyClientWithAuth).mockResolvedValue({
    get: privacyGetMock,
  } as unknown as Awaited<ReturnType<typeof createPublicPrivacyClientWithAuth>>);
  vi.mocked(createPublicTermsClientWithAuth).mockResolvedValue({
    get: termsGetMock,
  } as unknown as Awaited<ReturnType<typeof createPublicTermsClientWithAuth>>);

  getSettingMock.mockResolvedValue({ setting: null });
  setSettingMock.mockResolvedValue({ success: true });
  setManySettingsMock.mockResolvedValue({ success: true });
  regenerateOgImageMock.mockResolvedValue({ runId: 'manual-run', generationIds: ['generation-1'] });
  regenerateAllOgImagesMock.mockResolvedValue({ runId: 'global-run', generationCount: 12 });
  manifestGetMock.mockResolvedValue({
    settings: {
      siteOgAsset: {
        assetId: 'site-og-asset',
        url: 'https://cdn.example.com/asset/site-og-asset/og.webp',
      },
    },
  });
  privacyGetMock.mockResolvedValue({
    privacy: {
      ogAsset: {
        assetId: 'privacy-og-asset',
        url: 'https://cdn.example.com/asset/privacy-og-asset/og.webp',
      },
    },
  });
  termsGetMock.mockResolvedValue({
    terms: {
      ogAsset: {
        assetId: 'terms-og-asset',
        url: 'https://cdn.example.com/asset/terms-og-asset/og.webp',
      },
    },
  });
});

describe('site setting asset actions', () => {
  it('queues all-locale privacy OG refresh after privacy background upload completes', async () => {
    setSettingMock.mockResolvedValueOnce({ success: true, ogGenerationRunId: 'privacy-run' });
    await expect(setSiteAssetAction('privacy_og_background', 'file-1')).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'privacy-run',
    });

    expect(setSettingMock).toHaveBeenCalledWith({
      key: 'privacy_og_background_file_id',
      value: { kind: { case: 'stringValue', value: 'file-1' } },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/privacy');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/privacy');
  });

  it('queues all-locale terms OG refresh after terms background removal completes', async () => {
    getSettingMock.mockResolvedValue({
      setting: {
        value: { kind: { case: 'stringValue', value: 'old-file' } },
      },
    });
    setSettingMock.mockResolvedValueOnce({ success: true, ogGenerationRunId: 'terms-run' });

    await expect(deleteSiteAssetAction('terms_og_background')).resolves.toEqual({
      success: true,
      assetUrl: null,
      ogGenerationRunId: 'terms-run',
    });

    expect(setSettingMock).toHaveBeenCalledWith({
      key: 'terms_og_background_file_id',
      value: { kind: { case: 'nullValue', value: 0 } },
    });
    expect(createFileClient).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/terms');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/terms');
  });

  it('clears a favicon reference without deleting the original file', async () => {
    setSettingMock.mockResolvedValueOnce({ success: true, ogGenerationRunId: 'favicon-run' });

    await expect(deleteSiteAssetAction('favicon')).resolves.toEqual({
      success: true,
      assetUrl: null,
      ogGenerationRunId: 'favicon-run',
    });
    expect(setSettingMock).toHaveBeenCalledWith({
      key: 'favicon_file_id',
      value: { kind: { case: 'nullValue', value: 0 } },
    });
    expect(getSettingMock).not.toHaveBeenCalled();
    expect(createFileClient).not.toHaveBeenCalled();
  });

  it('rejects malformed settings before SetMany', async () => {
    for (const payload of [{ future_setting: 'not-writable' }, { site_title: undefined }, []]) {
      await expect(updateSiteSettingsAction(payload as never)).resolves.toEqual({
        error: 'Invalid settings payload',
      });
    }

    expect(setManySettingsMock).not.toHaveBeenCalled();
  });

  it('preserves committed automatic and manual run identities when revalidation fails', async () => {
    setManySettingsMock.mockResolvedValueOnce({ success: true, ogGenerationRunId: 'settings-run' });
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    await expect(updateSiteSettingsAction({ site_title: 'Committed' } as never)).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'settings-run',
    });

    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    await expect(regenerateSiteOgImageAction()).resolves.toEqual({
      success: true,
      runId: 'manual-run',
      generationId: 'generation-1',
    });

    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    await expect(regenerateLegalOgImageAction('privacy', 'ja')).resolves.toEqual({
      success: true,
      runId: 'manual-run',
      generationId: 'generation-1',
    });
  });
});
