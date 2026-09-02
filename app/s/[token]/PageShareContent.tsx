import { DraftModeAlert } from '@/features/draft-mode/DraftModeAlert';
import { PageMediaDeliveryProvider } from '@/features/page/PageMediaDeliveryContext';
import { PageContentView } from '@/features/page/PageView/PageContentView';
import { buildPagePath } from '@/lib/utils/page-route';
import type { getPageViewWithToken } from '@/lib/queries/page';

export function PageShareContent({
  page,
  token,
  password,
  requestedLocale,
}: {
  page: NonNullable<Awaited<ReturnType<typeof getPageViewWithToken>>>;
  token: string;
  password?: string;
  requestedLocale: string;
}) {
  const slug = page.slug || page.id;
  return (
    <>
      <DraftModeAlert id={page.id} status={page.status} />
      <PageMediaDeliveryProvider
        idOrSlug={slug}
        requestedLocale={requestedLocale}
        shareToken={token}
        sharePassword={password}
      >
        <PageContentView
          page={page}
          pathname={buildPagePath(slug)}
          query={{ share: token }}
          requestedLocale={requestedLocale}
        />
      </PageMediaDeliveryProvider>
    </>
  );
}
