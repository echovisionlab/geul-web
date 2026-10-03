import { createClient } from '@connectrpc/connect';
import { WorkService as PublicWorkService } from '@echovisionlab/geul-proto/public/work_pb.ts';
import { createPublicBrowserTransport } from './public-transport';

export function createPublicWorkClient() {
  return createClient(PublicWorkService, createPublicBrowserTransport());
}

export function createPublicWorkClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicWorkService, createPublicBrowserTransport(acceptLanguageOverride));
}
