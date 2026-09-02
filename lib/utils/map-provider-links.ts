export type MapLinkProviderId = 'google' | 'naver';

export interface MapLinkPlaceInput {
  name?: string;
  lat: number;
  lng: number;
  googlePlaceId?: string | null;
}

export interface MapProviderLinkData {
  provider: MapLinkProviderId;
  label: string;
  webUrl: string;
  appUrl?: string;
}

function formatCoordinates(lat: number, lng: number) {
  return `${lat},${lng}`;
}

function getPlaceLabel(place: MapLinkPlaceInput) {
  return place.name?.trim() || formatCoordinates(place.lat, place.lng);
}

function getGooglePlaceID(place: MapLinkPlaceInput) {
  return place.googlePlaceId?.trim() || null;
}

export function buildGoogleMapProviderLink(place: MapLinkPlaceInput): MapProviderLinkData {
  const coordinates = formatCoordinates(place.lat, place.lng);
  const googlePlaceId = getGooglePlaceID(place);
  const label = getPlaceLabel(place);
  const appParams = new URLSearchParams({
    center: coordinates,
    q: googlePlaceId ? `place_id:${googlePlaceId}` : coordinates,
  });
  const webParams = new URLSearchParams({
    api: '1',
    query: googlePlaceId ? label : coordinates,
  });
  if (googlePlaceId) {
    webParams.set('query_place_id', googlePlaceId);
  }
  const webUrl = `https://www.google.com/maps/search/?${webParams.toString()}`;

  return {
    provider: 'google',
    label: 'Google Maps',
    appUrl: `comgooglemaps://?${appParams.toString()}`,
    webUrl,
  };
}

export function buildNaverMapProviderLink(place: MapLinkPlaceInput): MapProviderLinkData {
  const label = getPlaceLabel(place);
  const webParams = new URLSearchParams({
    lng: String(place.lng),
    lat: String(place.lat),
    title: label,
  });

  return {
    provider: 'naver',
    label: 'Naver Maps',
    appUrl: `nmap://place?lat=${place.lat}&lng=${place.lng}&name=${encodeURIComponent(label)}&appname=com.geul.web`,
    webUrl: `https://map.naver.com/?${webParams.toString()}`,
  };
}
