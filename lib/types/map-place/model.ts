import type { Coordinate } from '../common/coordinate';
import type { ValueType } from '../common/filter';

/**
 * Address components parsed from geocoding service
 */
export interface AddressComponents {
  street?: string; // route + street_number
  city?: string; // locality or sublocality
  region?: string; // administrative_area_level_1
  country?: string; // country
  postalCode?: string; // postal_code
}

export interface MapPlaceMemberSummary {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  deleted: boolean;
}

/**
 * Actor attribution is rendered only from the Member projection. A raw Member
 * UUID is not a nickname fallback; the API treats a missing projection as an
 * invariant failure.
 */
export function displayMapPlaceMemberNickname(member: MapPlaceMemberSummary | null | undefined): string {
  return member?.nickname || '-';
}

// Filter/Sort field definitions for DataTable (Admin)
export const mapPlaceFilterFields = {
  id: 'uuid',
  name: 'string',
  address: 'string',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const mapPlaceSortFields = ['name', 'created_at'] as const;

/**
 * Full MapPlace record from database (domain model)
 */
export interface MapPlace {
  id: string;
  name: string;
  address: string;
  coordinate: Coordinate;
  googlePlaceId: string | null;
  addressComponents: AddressComponents | null;
  imageFileId: string | null;
  createdByMemberId?: string | null;
  updatedByMemberId?: string | null;
  createdByMember?: MapPlaceMemberSummary | null;
  updatedByMember?: MapPlaceMemberSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Full MapPlace record from database (snake_case for DB queries)
 */
export interface MapPlaceSelect {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id: string | null;
  address_components: AddressComponents | null;
  image_file_id: string | null;
  created_by_member_id: string | null;
  updated_by_member_id: string | null;
  created_by_member?: MapPlaceMemberSummary | null;
  updated_by_member?: MapPlaceMemberSummary | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert MapPlaceSelect (DB format) to MapPlace (domain format)
 */
export function toMapPlace(select: MapPlaceSelect): MapPlace {
  return {
    id: select.id,
    name: select.name,
    address: select.address,
    coordinate: { lat: select.lat, lng: select.lng },
    googlePlaceId: select.google_place_id,
    addressComponents: select.address_components,
    imageFileId: select.image_file_id,
    createdByMemberId: select.created_by_member_id,
    updatedByMemberId: select.updated_by_member_id,
    createdByMember: select.created_by_member ?? null,
    updatedByMember: select.updated_by_member ?? null,
    createdAt: select.created_at,
    updatedAt: select.updated_at,
  };
}

/**
 * Basic MapPlace info for dropdowns and simple displays
 */
export interface MapPlaceBasic {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googlePlaceId?: string | null;
}

/**
 * MapPlace list item for admin table/card grid
 */
export interface MapPlaceListItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id: string | null;
  address_components: AddressComponents | null;
  image_file_id: string | null;
  created_by_member_id?: string | null;
  updated_by_member_id?: string | null;
  created_by_member?: MapPlaceMemberSummary | null;
  updated_by_member?: MapPlaceMemberSummary | null;
  created_at: Date;
  updated_at?: Date;
}

/**
 * Input for creating a new MapPlace
 */
export interface CreateMapPlaceInput {
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id?: string | null;
  address_components?: AddressComponents;
  image_file_id?: string;
}

/**
 * Input for updating a MapPlace
 */
export interface UpdateMapPlaceInput {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  google_place_id?: string | null;
  address_components?: AddressComponents | null;
  image_file_id?: string | null;
}

/**
 * PlaceEditor internal form state
 */
export interface PlaceEditorFormState {
  name: string;
  address: string;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  addressComponents: AddressComponents | null;
}
