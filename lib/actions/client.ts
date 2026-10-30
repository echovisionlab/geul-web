'use server';

import { logServerFailure } from '@/lib/logging/logger';
import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { queryResult } from '@/lib/api/query-result';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { ThemeAssetVariant } from '@echovisionlab/geul-proto/secure/common_pb.ts';
import { createClientClient, createPublicClientClientWithAuth } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';
import { themedAssetRefUrl } from '@/lib/utils/asset-ref';

export type ThemeAssetVariantName = 'light' | 'dark';

const logger = createLogger('client-actions');

function themeAssetVariantFromName(variant?: ThemeAssetVariantName): ThemeAssetVariant {
  return variant === 'dark' ? ThemeAssetVariant.DARK : ThemeAssetVariant.LIGHT;
}

export async function listClientsForBlockAction(input: {
  limit?: number;
  offset?: number;
  requestedLocale?: string | null;
}) {
  return queryResult(async () => {
    try {
      const client = await createPublicClientClientWithAuth(input.requestedLocale);
      const limit = input.limit ?? 24;
      const offset = input.offset ?? 0;
      const response = await client.list({ pagination: { limit, offset } });

      return {
        clients: (response.clients ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          website: item.website ?? null,
          logoUrl: themedAssetRefUrl(item.logoLightAsset, item.logoDarkAsset),
          logoLightUrl: item.logoLightAsset?.url ?? null,
          logoDarkUrl: item.logoDarkAsset?.url ?? null,
          createdAt: item.createdAt ? timestampDate(item.createdAt) : null,
        })),
        pagination: {
          total: response.pagination?.total ?? 0,
          limit,
          offset,
        },
      };
    } catch (err) {
      logger.error('Failed to list clients for page block', { error: err });
      throw err;
    }
  });
}

export async function getClientsForBlockByIdsAction(input: { ids: string[]; requestedLocale?: string | null }) {
  return queryResult(async () => {
    try {
      const client = await createPublicClientClientWithAuth(input.requestedLocale);
      const clients = await Promise.all(
        input.ids.map(async (id) => {
          try {
            const response = await client.get({ id });
            const item = response.client;
            if (!item) {
              return null;
            }
            return {
              id: item.id,
              name: item.name,
              website: item.website ?? null,
              logoUrl: themedAssetRefUrl(item.logoLightAsset, item.logoDarkAsset),
              logoLightUrl: item.logoLightAsset?.url ?? null,
              logoDarkUrl: item.logoDarkAsset?.url ?? null,
            };
          } catch (err) {
            if (isConnectErrorCode(err, Code.NotFound)) {
              logServerFailure('client-actions', 'getClientsForBlockByIdsAction', err);
              return null;
            }
            throw err;
          }
        }),
      );

      return clients.filter((item): item is NonNullable<(typeof clients)[number]> => item !== null);
    } catch (err) {
      logger.error('Failed to get clients for page block', { error: err });
      throw err;
    }
  });
}

export async function createClientAction(
  name: string,
  website?: string | null,
): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'client-actions',
    'createClientAction',
    async () => {
      const client = await createClientClient();
      const created = await client.createClient({ name, website: website || undefined });
      revalidatePath('/admin/clients');
      return { data: { id: created.id } };
    },
    { fallback: 'Failed to create client' },
  );
}

export async function deleteClientAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'client-actions',
    'deleteClientAction',
    async () => {
      const client = await createClientClient();
      await client.deleteClient({ id });
      revalidatePath('/admin/clients');
      return { success: true as const };
    },
    { fallback: 'Failed to delete client', messages: { [Code.NotFound]: 'Client not found' } },
  );
}

export async function updateClientAction(
  id: string,
  data: { name?: string; website?: string | null },
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'client-actions',
    'updateClientAction',
    async () => {
      const client = await createClientClient();
      await client.updateClient({
        id,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.website !== undefined ? { website: data.website ?? '' } : {}),
      });
      revalidatePath('/admin/clients');
      return { success: true as const };
    },
    { fallback: 'Failed to update client', messages: { [Code.NotFound]: 'Client not found' } },
  );
}

// === Logo Actions ===

export async function setClientLogoAction(
  clientId: string,
  fileId: string,
  variant?: ThemeAssetVariantName,
): Promise<ActionResult<{ url?: string }>> {
  return runAction(
    'client-actions',
    'setClientLogoAction',
    async () => {
      const client = await createClientClient();
      const protoVariant = themeAssetVariantFromName(variant);
      const response = await client.setClientLogo({ clientId, fileId, variant: protoVariant });
      const url = protoVariant === ThemeAssetVariant.DARK ? response.logoDarkAsset?.url : response.logoLightAsset?.url;
      return { url };
    },
    { fallback: 'Failed to set client logo', messages: { [Code.NotFound]: 'Client or file not found' } },
  );
}

export async function deleteClientLogoAction(
  clientId: string,
  variant?: ThemeAssetVariantName,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'client-actions',
    'deleteClientLogoAction',
    async () => {
      const client = await createClientClient();
      await client.deleteClientLogo({ clientId, variant: themeAssetVariantFromName(variant) });
      return { success: true as const };
    },
    { fallback: 'Failed to delete client logo' },
  );
}
