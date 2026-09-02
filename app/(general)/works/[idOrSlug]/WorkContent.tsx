import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LocalizationNotice } from '@/features/translation/LocalizationNotice';
import { toWorkViewModel } from '@/features/work/work-view-model';
import { getWorkView } from '@/lib/queries/work';
import { getBaseUrl } from '@/lib/utils/url.server';
import { WorkViewClient } from './WorkViewClient';

interface Props {
  idOrSlug: string;
  requestedLocale: string;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * Async component that fetches the authoritative typed Work Block document.
 */
export async function WorkContent({ idOrSlug, requestedLocale, query }: Props) {
  const tCreditList = await getTranslations('creditList');
  const work = await getWorkView(idOrSlug, { requestedLocale });

  if (!work) {
    notFound();
  }

  const baseUrl = await getBaseUrl();
  const shareUrl = `${baseUrl}/works/${work.slug || work.id}`;
  const transformedWork = toWorkViewModel(work, (index) => tCreditList('groupName', { index }));
  const routePath = `/works/${work.slug || work.id}`;

  return (
    <>
      <LocalizationNotice
        pathname={routePath}
        query={query}
        requestedLocale={requestedLocale}
        localizationInfo={transformedWork.localizationInfo}
        variant="subtle"
      />
      <WorkViewClient
        work={transformedWork}
        shareUrl={shareUrl}
        pathname={routePath}
        query={query}
        requestedLocale={requestedLocale}
      />
    </>
  );
}
