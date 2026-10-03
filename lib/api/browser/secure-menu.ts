import { createClient } from '@connectrpc/connect';
import { MenuService } from '@echovisionlab/geul-proto/secure/menu_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createMenuClient() {
  return createClient(MenuService, createBrowserTransport());
}
