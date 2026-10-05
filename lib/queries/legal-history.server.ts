import 'server-only';

import { cache } from 'react';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { isConnectErrorCode } from '@/lib/api/connect-error';
import { createPublicPrivacyClientWithAuth, createPublicTermsClientWithAuth } from '@/lib/api/server-client';
import { mapPublicLegalPage } from './legal-public-page';
import type { PublicLegalHistoryDetailInitialData, PublicLegalHistoryInitialData } from './legal-history';

type Kind = 'privacy' | 'terms';

async function createClient(kind: Kind, requestedLocale: string) {
  return kind === 'privacy'
    ? createPublicPrivacyClientWithAuth(requestedLocale)
    : createPublicTermsClientWithAuth(requestedLocale);
}

function policy(response: Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>['get']>>) {
  return 'privacy' in response ? response.privacy : 'terms' in response ? response.terms : null;
}

// Request-scoped only: publication and permissions are checked on each navigation.
export const getPublicLegalHistory = cache(
  async (kind: Kind, requestedLocale: string): Promise<PublicLegalHistoryInitialData> => {
    const client = await createClient(kind, requestedLocale);
    const [current, archived] = await Promise.all([
      client.get({}).catch((error: unknown) => {
        if (isConnectErrorCode(error, Code.NotFound)) {
          return null;
        }
        throw error;
      }),
      // Match the existing public list's empty-on-failure behavior.
      client.list({ limit: 100, offset: 0 }).catch(() => ({ items: [] })),
    ]);
    const active = current ? policy(current) : null;
    return {
      requestedLocale,
      updatedAt: Date.now(),
      active: active
        ? {
            id: active.id,
            version: active.version,
            effectiveFrom: active.effectiveFrom ? timestampDate(active.effectiveFrom) : null,
          }
        : null,
      archived: archived.items.map((item) => ({
        id: item.id,
        version: item.version,
        effectiveFrom: item.effectiveFrom ? timestampDate(item.effectiveFrom) : null,
        effectiveUntil: item.effectiveUntil ? timestampDate(item.effectiveUntil) : null,
      })),
    };
  },
);

export const getPublicLegalHistoryDetail = cache(
  async (kind: Kind, id: string, requestedLocale: string): Promise<PublicLegalHistoryDetailInitialData> => {
    const client = await createClient(kind, requestedLocale);
    try {
      const [selected, current] = await Promise.all([client.get({ id }), client.get({})]);
      const entity = policy(selected);
      const active = mapPublicLegalPage(entity, null).active;
      if (!active) {
        return { id, requestedLocale, updatedAt: Date.now(), data: null };
      }
      const isCurrent = policy(current)?.id === active.id;
      const summary = isCurrent
        ? null
        : (await client.list({ limit: 100, offset: 0 })).items.find((item) => item.id === active.id);
      return {
        id,
        requestedLocale,
        updatedAt: Date.now(),
        data: {
          ...active,
          status: isCurrent ? 'active' : 'archived',
          effectiveUntil: summary?.effectiveUntil ? timestampDate(summary.effectiveUntil) : null,
        },
      };
    } catch (error) {
      if (isConnectErrorCode(error, Code.NotFound)) {
        return { id, requestedLocale, updatedAt: Date.now(), data: null };
      }
      throw error;
    }
  },
);
