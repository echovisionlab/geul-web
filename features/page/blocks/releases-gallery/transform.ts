/** The fields of a published release that its list item needs (server and browser queries share them). */
export interface ReleaseListSource {
  id: string;
  slug?: string | null;
  title: string;
  artworkUrl?: string | null;
  releaseDate?: Date | null;
  artists: readonly { id?: string | null; slug?: string | null; name: string; role: string }[];
}

/** Primary artists when the release names any, otherwise all of them, each once. */
export function toReleaseListItem(release: ReleaseListSource) {
  const primaryArtists = release.artists.filter((artist) => artist.role.toLowerCase() === 'primary');
  const selectedArtists = primaryArtists.length > 0 ? primaryArtists : release.artists;
  const seenArtists = new Set<string>();
  const mainArtists = selectedArtists.flatMap((artist) => {
    const dedupeKey = artist.id || artist.slug || artist.name;
    if (!dedupeKey || seenArtists.has(dedupeKey)) {
      return [];
    }
    seenArtists.add(dedupeKey);
    return [{ id: dedupeKey, label: artist.name, href: `/artists/${artist.slug || artist.id}` }];
  });
  return {
    id: release.id,
    href: `/releases/${release.slug || release.id}`,
    title: release.title,
    imageUrl: release.artworkUrl ?? null,
    imageAlt: release.title,
    releaseDate: release.releaseDate?.toISOString() ?? null,
    mainArtists,
  };
}
