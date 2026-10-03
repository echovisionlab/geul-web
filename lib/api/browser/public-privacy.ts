import { createClient } from '@connectrpc/connect';
import { PrivacyService } from '@echovisionlab/geul-proto/public/privacy_pb.ts';
import { createPublicBrowserTransport } from './public-transport';

export function createPublicPrivacyClient() {
  return createClient(PrivacyService, createPublicBrowserTransport());
}

export function createPublicPrivacyClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PrivacyService, createPublicBrowserTransport(acceptLanguageOverride));
}
