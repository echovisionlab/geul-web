import { createClient } from '@connectrpc/connect';
import { ReleaseService } from '@echovisionlab/geul-proto/secure/release_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createReleaseClient() {
  return createClient(ReleaseService, createBrowserTransport());
}
