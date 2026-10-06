import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { toWorkViewModel } from '@/features/work/work-view-model';
import { getWorkView } from '@/lib/queries/work';
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

  const transformedWork = toWorkViewModel(work, (index) => tCreditList('groupName', { index }));
  const routePath = `/works/${work.slug || work.id}`;

  return <WorkViewClient work={transformedWork} pathname={routePath} query={query} requestedLocale={requestedLocale} />;
}
