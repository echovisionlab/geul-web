import { createClient } from '@connectrpc/connect';
import { AccountService } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createAccountClient() {
  return createClient(AccountService, createBrowserTransport());
}
