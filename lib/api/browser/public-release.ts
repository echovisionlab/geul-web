import { createClient } from '@connectrpc/connect';
import { ReleaseService as PublicReleaseService } from '@echovisionlab/geul-proto/public/release_pb.ts';
import { createPublicBrowserTransport } from './public-transport';

export function createPublicReleaseClient() {
  return createClient(PublicReleaseService, createPublicBrowserTransport());
}
