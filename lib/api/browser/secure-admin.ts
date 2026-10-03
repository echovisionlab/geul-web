import { createClient } from '@connectrpc/connect';
import { AdminService } from '@echovisionlab/geul-proto/secure/admin_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createAdminClient() {
  return createClient(AdminService, createBrowserTransport());
}
