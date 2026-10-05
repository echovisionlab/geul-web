import { getSocialIconBrandColors } from '@/components/core/Social/SocialIcon';
import { PLATFORM_CONFIGS, type SocialLinks } from '@/lib/types/common/social-links-model';
import { getDisplaySocialLinkEntries } from '@/lib/utils/social-links';
import type { SocialLinkDisplayViewModel } from './ui/SocialLinksDisplayView';

/** Project only the configured links and their glyphs across the server/client boundary. */
export function prepareSocialLinksDisplay(links: SocialLinks): SocialLinkDisplayViewModel[] {
  return getDisplaySocialLinkEntries(links).map((entry) => ({
    ...entry,
    label: PLATFORM_CONFIGS[entry.platform].label,
    glyph: {
      path: PLATFORM_CONFIGS[entry.platform].icon.path,
      ...getSocialIconBrandColors(entry.platform),
    },
  }));
}
