'use client';

import { PLATFORM_CONFIGS, type SocialLinks } from '@/lib/types/common/social-links';
import { getDisplaySocialLinkEntries } from '@/lib/utils/social-links';
import { SocialLinksDisplayView, type SocialLinksDisplayViewProps } from './ui/SocialLinksDisplayView';

export interface SocialLinksDisplayProps extends Omit<SocialLinksDisplayViewProps, 'entries'> {
  links: SocialLinks;
}

export function SocialLinksDisplay({ links, ...viewProps }: SocialLinksDisplayProps) {
  const entries = getDisplaySocialLinkEntries(links).map((entry) => ({
    ...entry,
    label: PLATFORM_CONFIGS[entry.platform].label,
  }));

  return <SocialLinksDisplayView {...viewProps} entries={entries} />;
}
