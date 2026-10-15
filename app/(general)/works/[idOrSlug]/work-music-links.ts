import { prepareSocialLinkFieldsDisplay } from '@/features/social-links/prepare-social-links-display';
import type { SocialLinkDisplayViewModel } from '@/features/social-links/ui/SocialLinksDisplayView';

/** Server-side (and story) preparation of a music project's link glyphs for WorkViewClient. */
export function prepareWorkMusicLinks(work: { type: string; metadata: unknown }): SocialLinkDisplayViewModel[] {
  if (work.type !== 'music_project') {
    return [];
  }
  const metadata = work.metadata as Record<string, unknown>;
  return prepareSocialLinkFieldsDisplay({
    spotify: metadata.spotifyUrl as string | undefined,
    bandcamp: metadata.bandcampUrl as string | undefined,
    soundcloud: metadata.soundcloudUrl as string | undefined,
    youtube: metadata.youtubeUrl as string | undefined,
  });
}
