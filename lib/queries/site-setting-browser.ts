import { isConnectError } from '@/lib/api/connect-error';
import { toJson } from '@bufbuild/protobuf';
import { ValueSchema } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createSiteSettingClient } from '@/lib/api/browser-client';
import type { OgImageConfigs, SiteSettingsView } from '@/lib/types/site-setting/config';
import { fromProtoAllSettings } from '@/lib/queries/site-setting-mapper';
import { createClientLogger } from '@/lib/utils/client-logger';

const logger = createClientLogger('site-setting-browser');

// Browser: get all site settings (for Client Component useQuery)
export async function getAllSiteSettings(): Promise<SiteSettingsView | null> {
  try {
    const client = createSiteSettingClient();
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

// Browser: get OG image config (for Client Component useQuery)
export async function getOgConfig(): Promise<OgImageConfigs | null> {
  try {
    const client = createSiteSettingClient();
    const response = await client.getSetting({ key: 'og_image_config' });
    if (!response.setting?.value) {
      return null;
    }
    const value = toJson(ValueSchema, response.setting.value);
    return value as OgImageConfigs | null;
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.PermissionDenied || err.code === Code.Unauthenticated) {
        return null;
      }
      logger.error('GetSetting RPC error', { error: err.message });
    }
    return null;
  }
}
