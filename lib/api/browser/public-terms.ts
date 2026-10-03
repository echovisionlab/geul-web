import { createClient } from '@connectrpc/connect';
import { TermsService } from '@echovisionlab/geul-proto/public/terms_pb.ts';
import { createPublicBrowserTransport } from './public-transport';

export function createPublicTermsClient() {
  return createClient(TermsService, createPublicBrowserTransport());
}

export function createPublicTermsClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(TermsService, createPublicBrowserTransport(acceptLanguageOverride));
}
