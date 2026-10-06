import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DraftModeAlert } from '@/features/draft-mode/DraftModeAlert';
import { toWorkViewModel } from '@/features/work/work-view-model';
import { getWorkViewWithShareToken } from '@/lib/queries/work';
import { WorkViewClient } from './WorkViewClient';

interface Props {
  idOrSlug: string;
  token: string;
  password?: string;
  requestedLocale: string;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * Async component that fetches the authoritative typed Work Block document with a share token.
 */
export async function WorkContentWithToken({ idOrSlug, token, password, requestedLocale, query }: Props) {
  const tCreditList = await getTranslations('creditList');
  const work = await getWorkViewWithShareToken(idOrSlug, token, requestedLocale, password);

  if (!work) {
    notFound();
  }

  const pathname = `/works/${work.slug || work.id}`;
  const transformedWork = toWorkViewModel(work, (index) => tCreditList('groupName', { index }));

  return (
    <>
      <DraftModeAlert id={work.id} status={work.status} />
      <WorkViewClient
        work={transformedWork}
        pathname={pathname}
        query={query}
        requestedLocale={requestedLocale}
        shareToken={token}
        sharePassword={password}
      />
    </>
  );
}
