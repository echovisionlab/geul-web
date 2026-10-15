import { parseReleaseListProps } from '@/features/page/blocks/releases-gallery/schema';
import { formatCountryDisplayName } from '@/lib/countries';

const artistReleaseListProps = parseReleaseListProps({
  limit: '500',
  columns: '8',
  layout: 'grid',
  imageAspectRatio: '1:1',
});

/**
 * Values `ArtistPublicView` renders but should not compute in the browser: the list block schema
 * (zod) and the country catalogue would otherwise ship in the public artist page's first load.
 */
export function prepareArtistPublicView(artist: { countryCode?: string | null }, uiLocale: string) {
  return {
    releaseListProps: artistReleaseListProps,
    countryName: formatCountryDisplayName(artist.countryCode, uiLocale),
  };
}
