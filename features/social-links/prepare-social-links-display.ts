import { prepareSocialIcon } from '@/components/core/Social';
import { PLATFORM_CONFIGS, type SocialLinks, type SocialPlatform } from '@/lib/types/common/social-links-model';
import { compactSocialLinks, getDisplaySocialLinkEntries } from '@/lib/utils/social-links';
import type { SocialLinkDisplayViewModel } from './ui/SocialLinksDisplayView';

/**
 * Project only the configured links and their glyphs across the server/client boundary. Call it on
 * the server (or in stories); client views render the result with `SocialLinksDisplayView` so the
 * platform icon catalog stays out of their bundles.
 */
export function prepareSocialLinksDisplay(links: SocialLinks): SocialLinkDisplayViewModel[] {
  return getDisplaySocialLinkEntries(links).map((entry) => ({
    ...entry,
    label: PLATFORM_CONFIGS[entry.platform].label,
    glyph: prepareSocialIcon(entry.platform),
  }));
}

/** `prepareSocialLinksDisplay` for platform-specific optional URL fields (for example streaming links). */
export function prepareSocialLinkFieldsDisplay(
  fields: Partial<Record<SocialPlatform, string | null | undefined>>,
): SocialLinkDisplayViewModel[] {
  return prepareSocialLinksDisplay(compactSocialLinks(fields));
}
