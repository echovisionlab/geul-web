import { createClient } from '@connectrpc/connect';
import { MemberService } from '@echovisionlab/geul-proto/secure/member_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createMemberClient() {
  return createClient(MemberService, createBrowserTransport());
}
