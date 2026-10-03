import { createClient } from '@connectrpc/connect';
import { ClientService } from '@echovisionlab/geul-proto/secure/client_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createClientClient() {
  return createClient(ClientService, createBrowserTransport());
}
