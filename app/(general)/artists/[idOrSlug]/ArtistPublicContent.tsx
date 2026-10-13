import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import { ArtistPublicView, type ArtistPublicViewProps } from './ArtistPublicView';
import { prepareArtistPublicView } from './artist-public-prepared';

export type ArtistPublicContentProps = Omit<
  ArtistPublicViewProps,
  'socialLinkEntries' | 'releaseListProps' | 'countryName'
>;

/**
 * Server boundary retains the production data contract; the rendered view is shared with the kit.
 * Social link glyphs, list block props and the country name are prepared here so the client view does not
 * ship the platform icon catalog, zod or the country catalogue.
 */
export async function ArtistPublicContent(props: ArtistPublicContentProps) {
  return (
    <ArtistPublicView
      {...props}
      {...prepareArtistPublicView(props.artist, props.uiLocale)}
      socialLinkEntries={prepareSocialLinksDisplay(props.artist.socialLinks ?? {})}
    />
  );
}
