import type { CalloutField } from '@/lib/types/map-theme/model';
import type { MapRendererPlace } from './types';
import type { MapCalloutViewModel } from './ui';

export function getCalloutFieldText(place: MapRendererPlace, field: CalloutField): string | null {
  switch (field) {
    case 'name':
      return place.name;
    case 'address':
      return place.address;
    case 'coordinates':
      return `${place.lat.toFixed(6)} / ${place.lng.toFixed(6)}`;
    case 'street':
      return place.addressComponents?.street ?? null;
    case 'city':
      return place.addressComponents?.city ?? null;
    case 'region':
      return place.addressComponents?.region ?? null;
    case 'country':
      return place.addressComponents?.country ?? null;
    case 'postalCode':
      return place.addressComponents?.postalCode ?? null;
  }
}

export function getPrimaryCalloutText(place: MapRendererPlace, fields: CalloutField[]): string {
  for (const field of fields) {
    const value = getCalloutFieldText(place, field);
    if (value !== null) {
      return value;
    }
  }
  return place.name;
}

export function buildCalloutViewModel(place: MapRendererPlace, fields: CalloutField[]): MapCalloutViewModel {
  const fieldTexts = fields
    .map((field) => getCalloutFieldText(place, field))
    .filter((text): text is string => text !== null);
  const primaryText = fieldTexts[0] ?? place.name;

  return {
    id: place.id,
    href: place.href,
    ariaLabel: primaryText,
    primaryText,
    secondaryLines: fieldTexts.slice(1),
  };
}
