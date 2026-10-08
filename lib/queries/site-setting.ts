import { throwQueryError } from '@/lib/api/query-error';
import { Code, ConnectError } from '@connectrpc/connect';
import { isConnectError } from '@/lib/api/connect-error';
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
      throw new ConnectError('Site settings response is missing', Code.Internal);
    }
    return fromProtoAllSettings(response.settings);
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetSettings RPC error', { error: err.message });
    }
    throwQueryError(err);
  }
}
