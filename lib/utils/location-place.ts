export interface LocationPlaceSummary {
  name: string;
  lat: number;
  lng: number;
  googlePlaceId?: string | null;
}

export interface FormattedLocationPlace {
  name: string | null;
  latitude: string;
  longitude: string;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function formatLocationPlace(place: LocationPlaceSummary): FormattedLocationPlace {
  const name = place.name.trim() || null;
  const latitude = formatCoordinate(place.lat);
  const longitude = formatCoordinate(place.lng);

  return {
    name,
    latitude,
    longitude,
  };
}
