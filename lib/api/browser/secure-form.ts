import { createClient } from '@connectrpc/connect';
import { FormService } from '@echovisionlab/geul-proto/secure/form_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createFormClient() {
  return createClient(FormService, createBrowserTransport());
}
