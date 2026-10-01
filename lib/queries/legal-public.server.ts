import 'server-only';

import { cache } from 'react';
import { Code } from '@connectrpc/connect';
import { isConnectErrorCode } from '@/lib/api/connect-error';
import { createPublicPrivacyClientWithAuth, createPublicTermsClientWithAuth } from '@/lib/api/server-client';
import { mapPublicLegalPage } from './legal-public-page';

// Metadata and the page body share a snapshot within one render request.
// This is request memoization, not a persistent cache of policy versions.
export const getPublicPrivacyPage = cache(async (requestedLocale: string) => {
  const client = await createPublicPrivacyClientWithAuth(requestedLocale);
  const response = await client.get({}).catch((error: unknown) => {
    if (isConnectErrorCode(error, Code.NotFound)) {
      return null;
    }
    throw error;
  });

  return {
    policy: response?.privacy ?? null,
    data: mapPublicLegalPage(response?.privacy, response?.scheduled),
    updatedAt: Date.now(),
  };
});

export const getPublicTermsPage = cache(async (requestedLocale: string) => {
  const client = await createPublicTermsClientWithAuth(requestedLocale);
  const response = await client.get({}).catch((error: unknown) => {
    if (isConnectErrorCode(error, Code.NotFound)) {
      return null;
    }
    throw error;
  });

  return {
    policy: response?.terms ?? null,
    data: mapPublicLegalPage(response?.terms, response?.scheduled),
    updatedAt: Date.now(),
  };
});
