'use client';

import type { SocialLinks } from '@/lib/types/common/social-links-model';
import { prepareSocialLinksDisplay } from './prepare-social-links-display';
import { SocialLinksDisplayView, type SocialLinksDisplayViewProps } from './ui/SocialLinksDisplayView';

export interface SocialLinksDisplayProps extends Omit<SocialLinksDisplayViewProps, 'entries'> {
  links: SocialLinks;
}

export function SocialLinksDisplay({ links, ...viewProps }: SocialLinksDisplayProps) {
  const entries = prepareSocialLinksDisplay(links);

  return <SocialLinksDisplayView {...viewProps} entries={entries} />;
}
