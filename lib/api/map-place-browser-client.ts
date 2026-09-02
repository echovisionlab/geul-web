'use client';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { Code, createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { MapPlaceService } from '@echovisionlab/geul-proto/secure/map_place_pb.ts';
import type { CreateMapPlaceInput } from '@/lib/types/map-place/model';

const BROWSER_RPC_BASE_URL = '/api/rpc';

function createMapPlaceBrowserTransport() {
  return createConnectTransport({
    baseUrl: BROWSER_RPC_BASE_URL,
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        credentials: 'include',
      }),
  });
}

export function createMapPlaceBrowserClient() {
  return createClient(MapPlaceService, createMapPlaceBrowserTransport());
}

function toAddressComponents(addressComponents?: CreateMapPlaceInput['address_components']) {
  if (!addressComponents) {
    return undefined;
  }

  return {
    street: addressComponents.street,
    city: addressComponents.city,
    region: addressComponents.region,
    country: addressComponents.country,
    postalCode: addressComponents.postalCode,
  };
}

export async function createMapPlaceWithBrowserClient(
  data: CreateMapPlaceInput,
): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = createMapPlaceBrowserClient();
    const result = await client.createMapPlace({
      name: data.name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      googlePlaceId: data.google_place_id ?? undefined,
      addressComponents: toAddressComponents(data.address_components),
      imageFileId: data.image_file_id,
    });

    return { data: { id: result.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }

    return { error: err instanceof Error ? err.message : 'Failed to create place' };
  }
}

export async function createMapPlaceForBlockWithBrowserClient(
  data: CreateMapPlaceInput,
): Promise<{ id: string; lat: number; lng: number } | null> {
  try {
    const client = createMapPlaceBrowserClient();
    const result = await client.createMapPlace({
      name: data.name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      googlePlaceId: data.google_place_id ?? undefined,
      addressComponents: toAddressComponents(data.address_components),
      imageFileId: data.image_file_id,
    });

    return { id: result.id, lat: result.lat, lng: result.lng };
  } catch (err) {
    return null;
  }
}
