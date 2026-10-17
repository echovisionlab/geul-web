import type { ArtistListViewClientProps } from './ViewClientRuntime';

type SocialLinkEntries = ArtistListViewClientProps['artists'][number]['socialLinkEntries'];

/** The fields of an artist that its list item needs; social glyphs are prepared by the caller. */
export interface ArtistListSource {
  id: string;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
}

export function toArtistListItem(artist: ArtistListSource, socialLinkEntries: SocialLinkEntries) {
  return {
    id: artist.id,
    href: `/artists/${artist.slug?.trim() || artist.id}`,
    title: artist.name,
    imageUrl: artist.imageUrl ?? null,
    imageAlt: artist.name,
    socialLinkEntries,
  };
}
