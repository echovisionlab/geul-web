import { createClient } from '@connectrpc/connect';
import { PostService } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createPostClient() {
  return createClient(PostService, createBrowserTransport());
}
