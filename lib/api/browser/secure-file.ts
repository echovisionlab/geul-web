import { createClient } from '@connectrpc/connect';
import { FileService } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createFileClient() {
  return createClient(FileService, createBrowserTransport());
}
