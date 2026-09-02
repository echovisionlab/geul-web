import { revalidatePath } from 'next/cache';
import { fromJson } from '@bufbuild/protobuf';
import { ValueSchema } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { OgEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
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
  addSiteLoaderAssetAction,
  deleteSiteAssetAction,
  getLegalOgImageAction,
  getSiteOgStatusAction,
  regenerateAllOgImagesAction,
  regenerateLegalOgImageAction,
  regenerateSiteOgImageAction,
  removeSiteLoaderAssetAction,
  setSiteAssetAction,
  updateContentOgConfigAction,
  updateHomeOgConfigAction,
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

  it('queues homepage OG refresh after site background upload completes', async () => {
    setSettingMock.mockResolvedValueOnce({ success: true, ogGenerationRunId: 'site-run' });
    await expect(setSiteAssetAction('site_og_background', 'file-1')).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'site-run',
    });

    expect(setSettingMock).toHaveBeenCalledWith({
      key: 'site_og_background_file_id',
      value: { kind: { case: 'stringValue', value: 'file-1' } },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('replaces a site asset through the owning settings mutation without consulting generic File delivery', async () => {
    setSettingMock.mockResolvedValueOnce({ success: true, ogGenerationRunId: 'site-run' });

    await expect(setSiteAssetAction('site_og_background', 'file-1')).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'site-run',
    });
    expect(getSettingMock).not.toHaveBeenCalled();
    expect(createFileClient).not.toHaveBeenCalled();
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

  it('returns the automatic full-regeneration run for the light logo', async () => {
    setSettingMock.mockResolvedValueOnce({ success: true, ogGenerationRunId: 'logo-run' });
    await expect(setSiteAssetAction('logo_light', 'file-1')).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'logo-run',
    });

    expect(setSettingMock).toHaveBeenCalledWith({
      key: 'logo_light_file_id',
      value: { kind: { case: 'stringValue', value: 'file-1' } },
    });
    expect(createFileClient).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('does not report an OG run for a dark logo', async () => {
    await expect(setSiteAssetAction('logo_dark', 'file-1')).resolves.toEqual({
      success: true,
    });
    expect(setSettingMock).toHaveBeenCalledWith({
      key: 'logo_dark_file_id',
      value: { kind: { case: 'stringValue', value: 'file-1' } },
    });
  });

  it('updates settings with targeted cache invalidation', async () => {
    setManySettingsMock.mockResolvedValueOnce({ success: true, ogGenerationRunId: 'settings-run' });
    await expect(
      updateSiteSettingsAction({
        site_title: 'Example Studio',
        homepage_page_id: 'page-1',
        meta_description: 'Description',
      } as never),
    ).resolves.toEqual({ success: true, ogGenerationRunId: 'settings-run' });
    await expect(updateSiteSettingsAction({} as never)).resolves.toEqual({ success: true });
    await expect(updateSiteSettingsAction(null as never)).resolves.toEqual({
      error: 'Invalid settings payload',
    });

    expect(setManySettingsMock).toHaveBeenCalledWith({
      settings: expect.arrayContaining([
        expect.objectContaining({ key: 'site_title' }),
        expect.objectContaining({ key: 'homepage_page_id' }),
        expect.objectContaining({ key: 'meta_description' }),
      ]),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/');
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

  it('updates and regenerates OG image configs through the admin service', async () => {
    setSettingMock.mockResolvedValue({ success: true, ogGenerationRunId: 'config-run' });

    await expect(updateHomeOgConfigAction({ title: 'Home' } as never)).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'config-run',
    });
    await expect(updateContentOgConfigAction({ title: 'Content' } as never)).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'config-run',
    });
    await expect(regenerateSiteOgImageAction()).resolves.toEqual({
      success: true,
      runId: 'manual-run',
      generationId: 'generation-1',
    });
    await expect(regenerateAllOgImagesAction()).resolves.toEqual({
      success: true,
      runId: 'global-run',
      generationCount: 12,
    });

    expect(setSettingMock).toHaveBeenNthCalledWith(1, {
      key: 'og_image_config.home',
      value: fromJson(ValueSchema, { title: 'Home' }),
    });
    expect(setSettingMock).toHaveBeenNthCalledWith(2, {
      key: 'og_image_config.content',
      value: fromJson(ValueSchema, { title: 'Content' }),
    });
    expect(getSettingMock).not.toHaveBeenCalled();
    expect(regenerateOgImageMock).toHaveBeenCalledWith({
      entityType: OgEntityType.SITE,
      entityId: undefined,
      selection: { target: { case: 'primary', value: {} } },
    });
    expect(regenerateAllOgImagesMock).toHaveBeenCalledWith({});
  });

  it('surfaces an atomic OG config section update failure without a stale pre-read', async () => {
    setSettingMock.mockRejectedValue(new ConnectError('stored counterpart is malformed', Code.FailedPrecondition));

    await expect(updateContentOgConfigAction({ title: 'Content' } as never)).resolves.toEqual({
      error: '[failed_precondition] stored counterpart is malformed',
    });
    expect(getSettingMock).not.toHaveBeenCalled();
  });

  it('loads and regenerates site and legal OG image status', async () => {
    await expect(getSiteOgStatusAction()).resolves.toEqual({
      data: {
        assetId: 'site-og-asset',
        url: 'https://cdn.example.com/asset/site-og-asset/og.webp',
      },
    });
    await expect(getLegalOgImageAction('privacy', 'ko')).resolves.toEqual({
      data: {
        assetId: 'privacy-og-asset',
        url: 'https://cdn.example.com/asset/privacy-og-asset/og.webp',
      },
    });
    await expect(getLegalOgImageAction('terms')).resolves.toEqual({
      data: {
        assetId: 'terms-og-asset',
        url: 'https://cdn.example.com/asset/terms-og-asset/og.webp',
      },
    });
    await expect(regenerateLegalOgImageAction('privacy')).resolves.toEqual({
      success: true,
      runId: 'manual-run',
      generationId: 'generation-1',
    });

    expect(createPublicPrivacyClientWithAuth).toHaveBeenCalledWith('ko');
    expect(createPublicTermsClientWithAuth).toHaveBeenCalledWith(null);
    expect(regenerateOgImageMock).toHaveBeenCalledWith({
      entityType: OgEntityType.PRIVACY,
      entityId: undefined,
      selection: { target: { case: 'primary', value: {} } },
    });
  });

  it('adds and removes loader references without deleting the original file', async () => {
    await expect(addSiteLoaderAssetAction('file-1')).resolves.toEqual({ success: true });
    await expect(removeSiteLoaderAssetAction('file-1')).resolves.toEqual({ success: true });

    expect(addSiteLoaderAssetMock).toHaveBeenCalledWith({ fileId: 'file-1' });
    expect(removeSiteLoaderAssetMock).toHaveBeenCalledWith({ fileId: 'file-1' });
    expect(createFileClient).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});
