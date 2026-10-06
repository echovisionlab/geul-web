import { notFound } from 'next/navigation';
import { PageRestrictedAccess } from '@/features/page/PageRestrictedAccess';
import { DraftModeAlert } from '@/features/draft-mode/DraftModeAlert';
import { PageContentView } from '@/features/page/PageView/PageContentView';
import { PageMediaDeliveryProvider } from '@/features/page/PageMediaDeliveryContext';
import { getPageAccessViewWithToken } from '@/lib/queries/page';

interface Props {
  slug: string;
  token: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  password?: string;
}

export async function PageContentWithToken({ slug, token, query, requestedLocale, password }: Props) {
  const access = await getPageAccessViewWithToken(slug, token, requestedLocale, password);

  if (!access) {
    notFound();
  }

  if (access.reason !== 'allowed') {
    return <PageRestrictedAccess reason={access.reason} returnTo={`/${slug}?share=${encodeURIComponent(token)}`} />;
  }
  const page = access.page;
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
