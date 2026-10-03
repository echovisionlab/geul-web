import { createClient } from '@connectrpc/connect';
import { PageService } from '@echovisionlab/geul-proto/secure/page_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createPageClient() {
  return createClient(PageService, createBrowserTransport());
}
