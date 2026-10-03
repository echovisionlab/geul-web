import { createClient } from '@connectrpc/connect';
import { FileService as PublicFileService } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { createPublicBrowserTransport } from './public-transport';

export function createPublicFileClient() {
  return createClient(PublicFileService, createPublicBrowserTransport());
}
