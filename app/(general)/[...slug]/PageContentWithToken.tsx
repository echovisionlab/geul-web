import { notFound } from 'next/navigation';
import { DraftModeAlert } from '@/features/draft-mode/DraftModeAlert';
import { PageContentView } from '@/features/page/PageView/PageContentView';
import { PageMediaDeliveryProvider } from '@/features/page/PageMediaDeliveryContext';
import { getPageViewWithToken } from '@/lib/queries/page';

interface Props {
  slug: string;
  token: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  password?: string;
}

export async function PageContentWithToken({ slug, token, query, requestedLocale, password }: Props) {
  const page = await getPageViewWithToken(slug, token, requestedLocale, password);

  if (!page) {
    notFound();
  }

  return (
    <>
      <DraftModeAlert id={page.id} status={page.status ?? 'draft'} />
      <PageMediaDeliveryProvider
        idOrSlug={slug}
        requestedLocale={requestedLocale}
        shareToken={token}
        sharePassword={password}
      >
        <PageContentView
          page={page}
          pathname={slug === '/' ? '/' : `/${slug}`}
          query={query}
          requestedLocale={requestedLocale}
        />
      </PageMediaDeliveryProvider>
    </>
  );
}
