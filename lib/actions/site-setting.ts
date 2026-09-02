'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { fromJson, type JsonObject, type JsonValue } from '@bufbuild/protobuf';
import { ValueSchema, type Value } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import {
  createAdminClient,
  createManifestClient,
  createPublicPrivacyClientWithAuth,
  createPublicTermsClientWithAuth,
  createSiteSettingClient,
} from '@/lib/api/server-client';
import type { ContentOgImageConfig, HomeOgImageConfig, SiteSettingsPatch } from '@/lib/types/site-setting/config';
import { isSiteSettingsPatch } from '@/lib/types/site-setting/form';
import { type SiteAssetType } from '@/lib/types/upload/model';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('site-setting-actions');

export type LegalOgEntityType = 'privacy' | 'terms';

function revalidateAfterCommit(path: string, type?: 'layout' | 'page'): void {
  try {
    if (type) {
      revalidatePath(path, type);
    } else {
      revalidatePath(path);
    }
  } catch (error) {
    logger.warn('Site setting cache revalidation failed', {
      data: {
        resource_type: 'site_setting',
      },
      error,
    });
  }
}

function withOgGenerationRun<T extends object>(
  value: T,
  ogGenerationRunId: string | undefined,
): T & { ogGenerationRunId?: string } {
  return ogGenerationRunId ? { ...value, ogGenerationRunId } : value;
}

function normalizeToJsonValue(value: unknown): JsonValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeToJsonValue(item));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, normalizeToJsonValue(nested)] as const);
    return Object.fromEntries(entries) as JsonObject;
  }
  return String(value);
}

function toProtoValue(value: unknown): Value {
  return fromJson(ValueSchema, normalizeToJsonValue(value));
}

// Define setting key groups for targeted cache invalidation
const LAYOUT_KEYS = [
  'site_title',
  'primary_color',
  'menu_header_id',
  'menu_secondary_id',
  'menu_footer_id',
  'menu_avatar_dropdown_id',
] as const;

const HOMEPAGE_KEYS = ['homepage_page_id'] as const;

const SEO_KEYS = ['meta_description', 'google_analytics_id', 'site_title'] as const;

function legalOgEntityTypeFromAsset(type: SiteAssetType): LegalOgEntityType | null {
  if (type === 'privacy_og_background') {
    return 'privacy';
  }
  if (type === 'terms_og_background') {
    return 'terms';
  }
  return null;
}

function siteAssetFileIdKey(type: SiteAssetType): string {
  return `${type}_file_id`;
}

function revalidateSiteAssetDependents(type: SiteAssetType): void {
  const legalEntityType = legalOgEntityTypeFromAsset(type);
  if (legalEntityType) {
    revalidatePath(`/${legalEntityType}`);
    revalidatePath(`/admin/${legalEntityType}`);
    return;
  }

  if (type === 'site_og_background') {
    revalidatePath('/');
    return;
  }

  revalidatePath('/', 'layout');
}

export async function updateSiteSettingsAction(
  settings: SiteSettingsPatch,
): Promise<{ success?: boolean; ogGenerationRunId?: string; error?: string }> {
  try {
    if (!isSiteSettingsPatch(settings)) {
      return { error: 'Invalid settings payload' };
    }

    const client = await createSiteSettingClient();

    // Convert settings to proto format
    const protoSettings = Object.entries(settings).map(([key, value]) => ({
      key,
      value: toProtoValue(value),
    }));

    if (protoSettings.length === 0) {
      return { success: true };
    }

    const response = await client.setManySettings({ settings: protoSettings as never });

    const changedKeys = Object.keys(settings);

    // Revalidate layout if branding/menu settings changed
    const hasLayoutChange = LAYOUT_KEYS.some((key) => changedKeys.includes(key));
    if (hasLayoutChange) {
      revalidateAfterCommit('/', 'layout');
    }

    // Revalidate homepage if homepage settings changed
    const hasHomepageChange = HOMEPAGE_KEYS.some((key) => changedKeys.includes(key));
    if (hasHomepageChange) {
      revalidateAfterCommit('/');
    }

    // Revalidate all pages if SEO settings changed (affects meta tags)
    const hasSeoChange = SEO_KEYS.some((key) => changedKeys.includes(key));
    if (hasSeoChange && !hasLayoutChange) {
      // Only if not already revalidating layout (which covers everything)
      revalidateAfterCommit('/', 'page');
    }

    return withOgGenerationRun({ success: true }, response.ogGenerationRunId);
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update settings' };
  }
}

export async function updateHomeOgConfigAction(
  config: HomeOgImageConfig,
): Promise<{ success?: boolean; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createSiteSettingClient();
    const response = await client.setSetting({
      key: 'og_image_config.home',
      value: toProtoValue(config),
    });
    return withOgGenerationRun({ success: true }, response.ogGenerationRunId);
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update home OG config' };
  }
}

export async function getSiteOgStatusAction(): Promise<{
  data?: { assetId: string | null; url?: string };
  error?: string;
}> {
  try {
    const client = await createManifestClient();
    const response = await client.get({});
    const asset = response.settings?.siteOgAsset;

    return {
      data: {
        assetId: asset?.assetId ?? null,
        url: asset?.url,
      },
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to load site OG image' };
  }
}

export async function regenerateSiteOgImageAction(): Promise<{
  success?: boolean;
  runId?: string;
  generationId?: string;
  error?: string;
}> {
  const result = await requestOgImageRegeneration({
    entityType: 'site',
    selection: { type: 'primary' },
  });
  if (result.error) {
    return { error: result.error };
  }
  revalidateAfterCommit('/');
  return { success: true, runId: result.runId, generationId: result.generationIds?.[0] };
}

export async function getLegalOgImageAction(
  entityType: LegalOgEntityType,
  requestedLocale?: string | null,
): Promise<{
  data?: { assetId: string | null; url?: string };
  error?: string;
}> {
  try {
    const locale = requestedLocale?.trim() || null;
    let assetId: string | null = null;
    let url: string | undefined;
    if (entityType === 'privacy') {
      const client = await createPublicPrivacyClientWithAuth(locale);
      const response = await client.get({});
      assetId = response.privacy?.ogAsset?.assetId ?? null;
      url = response.privacy?.ogAsset?.url;
    } else {
      const client = await createPublicTermsClientWithAuth(locale);
      const response = await client.get({});
      assetId = response.terms?.ogAsset?.assetId ?? null;
      url = response.terms?.ogAsset?.url;
    }

    return {
      data: {
        assetId,
        url,
      },
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to load legal OG image' };
  }
}

export async function regenerateLegalOgImageAction(
  entityType: LegalOgEntityType,
  locale?: string | null,
): Promise<{ success?: boolean; runId?: string; generationId?: string; error?: string }> {
  const scopedLocale = locale?.trim();
  const result = await requestOgImageRegeneration({
    entityType,
    selection: scopedLocale ? { type: 'locale', locale: scopedLocale } : { type: 'primary' },
  });
  if (result.error) {
    return { error: result.error };
  }
  revalidateAfterCommit(`/${entityType}`);
  revalidateAfterCommit(`/admin/${entityType}`);
  return { success: true, runId: result.runId, generationId: result.generationIds?.[0] };
}

export async function updateContentOgConfigAction(
  config: ContentOgImageConfig,
): Promise<{ success?: boolean; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createSiteSettingClient();
    const response = await client.setSetting({
      key: 'og_image_config.content',
      value: toProtoValue(config),
    });
    return withOgGenerationRun({ success: true }, response.ogGenerationRunId);
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update content OG config' };
  }
}

export async function regenerateAllOgImagesAction(): Promise<{
  success?: boolean;
  runId?: string;
  generationCount?: number;
  error?: string;
}> {
  try {
    // Queue regeneration of all OG images via Backend API
    const adminClient = await createAdminClient();
    const response = await adminClient.regenerateAllOgImages({});
    return { success: true, runId: response.runId, generationCount: response.generationCount };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to regenerate OG images' };
  }
}

// === Site Asset Actions ===

export async function setSiteAssetAction(
  type: SiteAssetType,
  fileId: string,
): Promise<{ success?: boolean; error?: string; warning?: string; ogGenerationRunId?: string }> {
  try {
    const fileIdKey = siteAssetFileIdKey(type);
    const client = await createSiteSettingClient();

    const settingResponse = await client.setSetting({
      key: fileIdKey,
      value: { kind: { case: 'stringValue' as const, value: fileId } },
    });

    let warning: string | undefined;

    try {
      revalidateSiteAssetDependents(type);
    } catch (revalidateErr) {
      logger.warn('Site asset cache revalidation failed', {
        data: {
          resource_type: 'site_asset',
          asset_type: type,
        },
        error: revalidateErr,
      });
      warning ??= 'Asset saved but cache refresh is pending.';
    }

    const result = withOgGenerationRun({ success: true as const }, settingResponse.ogGenerationRunId);
    return warning ? { ...result, warning } : result;
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to set asset' };
  }
}

export async function deleteSiteAssetAction(
  type: SiteAssetType,
): Promise<{ success?: boolean; error?: string; warning?: string; assetUrl?: null; ogGenerationRunId?: string }> {
  try {
    const fileIdKey = siteAssetFileIdKey(type);
    const client = await createSiteSettingClient();

    const settingResponse = await client.setSetting({
      key: fileIdKey,
      value: { kind: { case: 'nullValue' as const, value: 0 } },
    });

    let warning: string | undefined;

    try {
      revalidateSiteAssetDependents(type);
    } catch (revalidateErr) {
      logger.warn('Removed site asset cache revalidation failed', {
        data: {
          resource_type: 'site_asset',
          asset_type: type,
        },
        error: revalidateErr,
      });
      warning ??= 'Asset removed but cache refresh is pending.';
    }

    const result = withOgGenerationRun({ success: true as const, assetUrl: null }, settingResponse.ogGenerationRunId);
    return warning ? { ...result, warning } : result;
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete asset' };
  }
}

export async function addSiteLoaderAssetAction(fileId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createSiteSettingClient();
    await client.addSiteLoaderAsset({ fileId });
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to add loader asset' };
  }
}

export async function removeSiteLoaderAssetAction(
  fileId: string,
): Promise<{ success?: boolean; error?: string; warning?: string }> {
  try {
    const client = await createSiteSettingClient();
    await client.removeSiteLoaderAsset({ fileId });
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove loader asset' };
  }
}
