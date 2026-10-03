import { createClient } from '@connectrpc/connect';
import { LabelService } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createLabelClient() {
  return createClient(LabelService, createBrowserTransport());
}
