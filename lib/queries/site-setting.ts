import { isConnectError } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';
import { createSiteSettingClient } from '@/lib/api/server-client';
import { fromProtoAllSettings } from '@/lib/queries/site-setting-mapper';
import type { SiteSettingsView } from '@/lib/types/site-setting/config';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('site-setting-queries');

// ============================================
// Server Component queries for SiteSetting domain
// ============================================

/**
 * Get all site settings including sensitive ones (admin only)
 */
export async function getAllSiteSettings(): Promise<SiteSettingsView | null> {
  try {
    const client = await createSiteSettingClient();
    const response = await client.getSettings({});
    if (!response.settings) {
      return null;
    }
    return fromProtoAllSettings(response.settings);
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.PermissionDenied || err.code === Code.Unauthenticated) {
        return null;
      }
      logger.error('GetSettings RPC error', { error: err.message });
    }
    return null;
  }
}
