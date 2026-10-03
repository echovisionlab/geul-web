import { createClient } from '@connectrpc/connect';
import { TranslationService } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createTranslationClient() {
  return createClient(TranslationService, createBrowserTransport());
}
