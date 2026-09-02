import type { AddressComponents } from '@/lib/types/map-place/model';

/**
 * Parse Google Places API address_components into AddressComponents
 *
 * Handles country-specific edge cases:
 * - UK/Sweden: uses postal_town (no locality)
 * - NYC/Japan: uses sublocality_level_1
 * - 30+ countries: no postal_code
 */
export function parseAddressComponents(components: google.maps.places.AddressComponent[]): AddressComponents {
  // Find first component matching the type (respects priority order)
  const findByPriority = (...types: string[]): string | undefined => {
    for (const type of types) {
      const found = components.find((c) => c.types.includes(type));
      if (found) {
        return found.longText ?? undefined;
      }
    }
    return undefined;
  };

  const streetNumber = findByPriority('street_number') ?? '';
  const route = findByPriority('route') ?? '';
  // Korean addresses: use premise (building name) or sublocality_level_4 (도로명 번호)
  const premise = findByPriority('premise', 'subpremise') ?? '';
  const sublocalityDetail = findByPriority('sublocality_level_4', 'sublocality_level_3') ?? '';

  // Build street: prefer route + number, fallback to Korean-style components
  let street: string | undefined;
  if (route || streetNumber) {
    street = [route, streetNumber].filter(Boolean).join(' ');
  } else if (sublocalityDetail) {
    // 도로명 주소: sublocality_level_4 (도로명) + premise (번지)
    street = [sublocalityDetail, premise].filter(Boolean).join(' ');
  } else if (premise) {
    // 지번 주소: sublocality_level_2 (동) + premise (번지)
    const dong = findByPriority('sublocality_level_2');
    street = [dong, premise].filter(Boolean).join(' ');
  }

  return {
    street: street || undefined,
    // City: locality first, then 구 (sublocality_level_1) for Korean addresses
    city: findByPriority('locality', 'sublocality_level_1', 'postal_town'),
    region: findByPriority('administrative_area_level_1'),
    country: findByPriority('country'),
    postalCode: findByPriority('postal_code'),
  };
}

/**
 * Parse Geocoder result address_components into AddressComponents
 * (Geocoder uses GeocoderAddressComponent which has long_name/short_name instead of longText/shortText)
 */
export function parseGeocoderAddressComponents(components: google.maps.GeocoderAddressComponent[]): AddressComponents {
  // Find first component matching the type (respects priority order)
  const findByPriority = (...types: string[]): string | undefined => {
    for (const type of types) {
      const found = components.find((c) => c.types.includes(type));
      if (found) {
        return found.long_name;
      }
    }
    return undefined;
  };

  const streetNumber = findByPriority('street_number') ?? '';
  const route = findByPriority('route') ?? '';
  // Korean addresses: use premise (building name) or sublocality_level_4 (도로명 번호)
  const premise = findByPriority('premise', 'subpremise') ?? '';
  const sublocalityDetail = findByPriority('sublocality_level_4', 'sublocality_level_3') ?? '';

  // Build street: prefer route + number, fallback to Korean-style components
  let street: string | undefined;
  if (route || streetNumber) {
    street = [route, streetNumber].filter(Boolean).join(' ');
  } else if (sublocalityDetail) {
    // 도로명 주소: sublocality_level_4 (도로명) + premise (번지)
    street = [sublocalityDetail, premise].filter(Boolean).join(' ');
  } else if (premise) {
    // 지번 주소: sublocality_level_2 (동) + premise (번지)
    const dong = findByPriority('sublocality_level_2');
    street = [dong, premise].filter(Boolean).join(' ');
  }

  return {
    street: street || undefined,
    // City: locality first, then 구 (sublocality_level_1) for Korean addresses
    city: findByPriority('locality', 'sublocality_level_1', 'postal_town'),
    region: findByPriority('administrative_area_level_1'),
    country: findByPriority('country'),
    postalCode: findByPriority('postal_code'),
  };
}
