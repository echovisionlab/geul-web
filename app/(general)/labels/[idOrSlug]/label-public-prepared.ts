import { parseArtistListProps } from '@/features/page/blocks/artist-grid/schema';
import { parseReleaseListProps } from '@/features/page/blocks/releases-gallery/schema';
import { formatCountryDisplayName } from '@/lib/countries';

const labelReleaseListProps = parseReleaseListProps({
  limit: '12',
  columns: '4',
  layout: 'grid',
  imageAspectRatio: '1:1',
});

const labelArtistListProps = parseArtistListProps({
  limit: '12',
  columns: '6',
  layout: 'grid',
  itemSize: 'xs',
  imageAspectRatio: '1:1',
  showMeta: 'false',
});

/**
 * Values `LabelPublicView` renders but should not compute in the browser: the list block schemas
 * (zod) and the country catalogue would otherwise ship in the public label page's first load.
 */
export function prepareLabelPublicView(label: { countryCode?: string | null }, uiLocale: string) {
  return {
    releaseListProps: labelReleaseListProps,
    artistListProps: labelArtistListProps,
    countryName: formatCountryDisplayName(label.countryCode, uiLocale),
  };
}
