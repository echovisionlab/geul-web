import { createClient } from '@connectrpc/connect';
import { PostService as PublicPostService } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { createPublicBrowserTransport } from './public-transport';

export function createPublicPostClient() {
  return createClient(PublicPostService, createPublicBrowserTransport());
}

export function createPublicPostClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicPostService, createPublicBrowserTransport(acceptLanguageOverride));
}
