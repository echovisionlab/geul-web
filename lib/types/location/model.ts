import type { Coordinate } from '../common/coordinate';
import type { AddressComponents } from '../map-place/model';

/**
 * Google Places API search result (temporary data before saving to DB)
 */
export interface GooglePlaceSearchResult {
  /** Google Places API place ID */
  placeId: string;
  /** Geographic coordinate */
  coordinate: Coordinate;
  /** Display name of the location */
  name?: string;
  /** Formatted address */
  address?: string;
  /** Parsed address components for callout display */
  addressComponents?: AddressComponents;
  /** Place photo URL (from Google) */
  photoUrl?: string;
}
