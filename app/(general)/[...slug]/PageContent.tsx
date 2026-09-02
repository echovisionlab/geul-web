import { notFound } from 'next/navigation';
import { PageContentView } from '@/features/page/PageView/PageContentView';
import { PageMediaDeliveryProvider } from '@/features/page/PageMediaDeliveryContext';
import { getPageView } from '@/lib/queries/page';

interface Props {
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
}

export async function PageContent({ slug, query, requestedLocale }: Props) {
  const page = await getPageView(slug, { requestedLocale });

  if (!page) {
    notFound();
  }

  return (
    <PageMediaDeliveryProvider idOrSlug={slug} requestedLocale={requestedLocale}>
      <PageContentView
        page={page}
        pathname={slug === '/' ? '/' : `/${slug}`}
        query={query}
        requestedLocale={requestedLocale}
      />
    </PageMediaDeliveryProvider>
  );
}
