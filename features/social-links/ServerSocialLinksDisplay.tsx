import 'server-only';

import { prepareSocialLinksDisplay } from './prepare-social-links-display';
import type { SocialLinksDisplayProps } from './SocialLinksDisplay';
import { SocialLinksDisplayView } from './ui/SocialLinksDisplayView';

/** Keep the complete platform catalog on the server for the public shell footer. */
export function ServerSocialLinksDisplay({ links, ...viewProps }: SocialLinksDisplayProps) {
  const entries = prepareSocialLinksDisplay(links);
  return entries.length > 0 ? <SocialLinksDisplayView {...viewProps} entries={entries} /> : null;
}
