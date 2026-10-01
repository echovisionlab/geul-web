import 'server-only';

import { cache } from 'react';
import { getTranslations } from 'next-intl/server';
import { localizedRichTextPlainText } from '@/features/editor/contract/localized-rich-text-text';
import { getPublicPrivacyPage, getPublicTermsPage } from '@/lib/queries/legal-public.server';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { truncateForDescription } from '@/lib/utils/og';

// Keep the metadata, structured data, and initial document tied to the same version.
export const getPublicLegalPagePresentation = cache(async (kind: 'privacy' | 'terms', requestedLocale: string) => {
  const [t, tEntities, site, snapshot] = await Promise.all([
    getTranslations(`${kind}Page.metadata`),
    getTranslations('common.entities'),
    getSiteMetadataDocument(),
    (kind === 'privacy' ? getPublicPrivacyPage(requestedLocale) : getPublicTermsPage(requestedLocale)).catch(
      () => null,
    ),
  ]);
  const content = snapshot?.data.active?.content;

  return {
    site,
    snapshot,
    title: snapshot?.policy?.title?.trim() || tEntities(kind),
    description:
      truncateForDescription(content ? localizedRichTextPlainText(content) : null) ||
      t('description', { siteName: site.siteTitle || 'Site' }),
  };
});
