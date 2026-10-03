import { createClient } from '@connectrpc/connect';
import { SiteSettingService } from '@echovisionlab/geul-proto/secure/site_setting_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createSiteSettingClient() {
  return createClient(SiteSettingService, createBrowserTransport());
}
