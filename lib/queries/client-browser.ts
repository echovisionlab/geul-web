import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createClientClient } from '@/lib/api/browser-client';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';
import { themedAssetRefUrl } from '@/lib/utils/asset-ref';

const logger = createClientLogger('client-browser');

// Browser: get single client (for Client Component useQuery)
export async function getClient(id: string) {
  try {
    const client = createClientClient();
    const response = await client.getClient({ id });
    return {
      id: response.id,
      name: response.name,
      website: response.website ?? null,
      logoUrl: themedAssetRefUrl(response.logoLightAsset, response.logoDarkAsset),
      logoLightUrl: response.logoLightAsset?.url ?? null,
      logoDarkUrl: response.logoDarkAsset?.url ?? null,
      createdAt: response.createdAt ? timestampDate(response.createdAt) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}

// Browser: search clients (for Client Component autocomplete)
export async function searchClients(query: string) {
  try {
    const client = createClientClient();
    const response = await client.searchClients({ query, limit: 10 });
    return (response.clients ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website ?? null,
      logoUrl: themedAssetRefUrl(c.logoLightAsset, c.logoDarkAsset),
      logoLightUrl: c.logoLightAsset?.url ?? null,
      logoDarkUrl: c.logoDarkAsset?.url ?? null,
    }));
  } catch (err) {
    logger.error('Failed to search clients', { error: serializeClientLogError(err) });
    return [];
  }
}

export async function listClientsForSelector() {
  try {
    const client = createClientClient();
    const response = await client.listClients({ pagination: { limit: 100, offset: 0 } });
    return (response.clients ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website ?? null,
      logoUrl: themedAssetRefUrl(c.logoLightAsset, c.logoDarkAsset),
      logoLightUrl: c.logoLightAsset?.url ?? null,
      logoDarkUrl: c.logoDarkAsset?.url ?? null,
    }));
  } catch (err) {
    logger.error('Failed to list clients', { error: serializeClientLogError(err) });
    return [];
  }
}
