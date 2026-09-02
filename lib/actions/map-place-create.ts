'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { Code } from '@connectrpc/connect';
import { createMapPlaceClient } from '@/lib/api/server-client';

interface AddressComponents {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
}

export interface CreateMapPlaceInput {
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id?: string | null;
  address_components?: AddressComponents;
  image_file_id?: string;
}

function toAddressComponents(addressComponents?: AddressComponents) {
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

export async function createMapPlaceAction(
  data: CreateMapPlaceInput,
): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createMapPlaceClient();
    const result = await client.createMapPlace({
      name: data.name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      googlePlaceId: data.google_place_id ?? undefined,
      addressComponents: toAddressComponents(data.address_components),
      imageFileId: data.image_file_id,
    });
    revalidatePath('/admin/map/places');
    return { data: { id: result.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create place' };
  }
}
