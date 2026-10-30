'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
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

export async function createMapPlaceAction(data: CreateMapPlaceInput): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'map-place-create-actions',
    'createMapPlaceAction',
    async () => {
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
    },
    { fallback: 'Failed to create place' },
  );
}
