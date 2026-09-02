'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  createMapPlaceClient,
  createPublicMapPlaceClient,
  createPublicMapPlaceClientWithAuth,
} from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('map-place-actions');

interface AddressComponents {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
}

interface UpdateMapPlaceInput {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  google_place_id?: string | null;
  address_components?: AddressComponents | null;
  image_file_id?: string | null;
}

function toMapPlaceMemberSummary(
  member:
    | {
        id: string;
        nickname: string;
        avatarAsset?: { url: string };
        deleted: boolean;
      }
    | undefined,
): { id: string; nickname: string; avatarUrl: string | null; deleted: boolean } | null {
  if (!member) {
    return null;
  }

  return {
    id: member.id,
    nickname: member.nickname,
    avatarUrl: member.avatarAsset?.url ?? null,
    deleted: member.deleted,
  };
}

export async function listMapPlacesAdminAction(input: { page?: number; pageSize?: number; search?: string }) {
  try {
    const client = await createMapPlaceClient();
    const limit = input.pageSize ?? 20;
    const offset = ((input.page ?? 1) - 1) * limit;

    const response = await client.listMapPlacesAdmin({
      pagination: { limit, offset },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.places ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        google_place_id: p.googlePlaceId ?? null,
        address_components: p.addressComponents
          ? {
              street: p.addressComponents.street ?? undefined,
              city: p.addressComponents.city ?? undefined,
              region: p.addressComponents.region ?? undefined,
              country: p.addressComponents.country ?? undefined,
              postalCode: p.addressComponents.postalCode ?? undefined,
            }
          : null,
        image_file_id: p.imageFileId ?? null,
        created_by_member_id: p.createdByMemberId ?? null,
        updated_by_member_id: p.updatedByMemberId ?? null,
        created_by_member: toMapPlaceMemberSummary(p.createdByMember),
        updated_by_member: toMapPlaceMemberSummary(p.updatedByMember),
        created_at: p.createdAt ? timestampDate(p.createdAt) : new Date(),
        updated_at: p.updatedAt ? timestampDate(p.updatedAt) : new Date(),
      })),
      total,
      page: input.page ?? 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }
    logger.error('Failed to list map places', { error: err });
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function deleteMapPlaceAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createMapPlaceClient();
    await client.deleteMapPlace({ id });
    revalidatePath('/admin/map/places');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Place not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete place' };
  }
}

export async function getMapPlaceAction(id: string) {
  try {
    const client = await createMapPlaceClient();
    const response = await client.getMapPlace({ id });
    return {
      id: response.id,
      name: response.name,
      address: response.address,
      lat: response.lat,
      lng: response.lng,
      googlePlaceId: response.googlePlaceId ?? null,
      addressComponents: response.addressComponents
        ? {
            street: response.addressComponents.street ?? undefined,
            city: response.addressComponents.city ?? undefined,
            region: response.addressComponents.region ?? undefined,
            country: response.addressComponents.country ?? undefined,
            postalCode: response.addressComponents.postalCode ?? undefined,
          }
        : null,
      imageFileId: response.imageFileId ?? null,
      imageUrl: response.imageAsset?.url ?? null,
      createdByMemberId: response.createdByMemberId ?? null,
      updatedByMemberId: response.updatedByMemberId ?? null,
      createdByMember: toMapPlaceMemberSummary(response.createdByMember),
      updatedByMember: toMapPlaceMemberSummary(response.updatedByMember),
      createdAt: response.createdAt ? timestampDate(response.createdAt) : new Date(),
      updatedAt: response.updatedAt ? timestampDate(response.updatedAt) : new Date(),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}

export async function updateMapPlaceAction(
  id: string,
  data: UpdateMapPlaceInput,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createMapPlaceClient();
    await client.updateMapPlace({
      id,
      name: data.name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      googlePlaceId: data.google_place_id === null ? '' : data.google_place_id,
      addressComponents: data.address_components
        ? {
            street: data.address_components.street,
            city: data.address_components.city,
            region: data.address_components.region,
            country: data.address_components.country,
            postalCode: data.address_components.postalCode,
          }
        : undefined,
      imageFileId: data.image_file_id ?? undefined,
      clearImage: data.image_file_id === null,
    });
    revalidatePath('/admin/map/places');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Place not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update place' };
  }
}

// Public: get multiple places by IDs (for Map block editor)
export async function getMapPlacesByIdsAction(ids: string[]) {
  try {
    const client = await createMapPlaceClient();
    const response = await client.getMapPlacesByIds({ ids });
    return (response.places ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      googlePlaceId: p.googlePlaceId ?? null,
      imageUrl: p.imageAsset?.url ?? null,
    }));
  } catch (err) {
    logger.error('Failed to get map places by IDs', { error: err });
    return [];
  }
}

export async function getPublicMapPlacesByIdsAction(ids: string[], requestedLocale?: string | null) {
  if (ids.length === 0) {
    return [];
  }

  try {
    const client = requestedLocale
      ? await createPublicMapPlaceClientWithAuth(requestedLocale)
      : createPublicMapPlaceClient();
    const response = await client.getByIds({ ids });
    return (response.places ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      googlePlaceId: p.googlePlaceId ?? null,
      addressComponents: p.addressComponents
        ? {
            street: p.addressComponents.street ?? undefined,
            city: p.addressComponents.city ?? undefined,
            region: p.addressComponents.region ?? undefined,
            country: p.addressComponents.country ?? undefined,
            postalCode: p.addressComponents.postalCode ?? undefined,
          }
        : null,
      imageUrl: p.imageAsset?.url ?? null,
    }));
  } catch (err) {
    logger.error('Failed to get public map places by IDs', { error: err });
    return [];
  }
}
