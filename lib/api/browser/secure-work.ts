import { createClient } from '@connectrpc/connect';
import { WorkService } from '@echovisionlab/geul-proto/secure/work_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createWorkClient() {
  return createClient(WorkService, createBrowserTransport());
}
