import { createClient } from '@connectrpc/connect';
import { EmailLayoutService } from '@echovisionlab/geul-proto/secure/email_layout_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createEmailLayoutClient() {
  return createClient(EmailLayoutService, createBrowserTransport());
}
