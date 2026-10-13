import { prepareSocialLinkFieldsDisplay } from '@/features/social-links/prepare-social-links-display';
import type { SocialLinkDisplayViewModel } from '@/features/social-links/ui/SocialLinksDisplayView';

/** Server-side (and story) preparation of the release page's streaming link glyphs. */
export function prepareReleaseStreamingLinks(release: {
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  bandcampUrl?: string | null;
  youtubeMusicUrl?: string | null;
}): SocialLinkDisplayViewModel[] {
  return prepareSocialLinkFieldsDisplay({
    spotify: release.spotifyUrl,
    applemusic: release.appleMusicUrl,
    bandcamp: release.bandcampUrl,
    youtubemusic: release.youtubeMusicUrl,
  });
}
