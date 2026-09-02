import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { MySection } from '@echovisionlab/geul-proto/secure/member_pb.ts';
import { getTranslations } from 'next-intl/server';
import { mySectionToPath, normalizeMySections } from '@/features/user/UserShell/sections';
import { getMySections } from '@/lib/queries/my-account';
import { UserShell } from '@/features/user/UserShell/UserShell';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getSettings } from '@/lib/queries/manifest';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { buildStaticOgMetadata } from '@/lib/utils/og';
import { getRequestPathnameFromHeaders, getRequestPathWithSearchFromHeaders } from '@/lib/utils/request-path';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';

export const dynamic = 'force-dynamic';

function getMyNavigationKey(pathname: string): string {
  if (pathname.startsWith('/my/series/')) {
    return 'series';
  }

  switch (pathname) {
    case '/my':
      return 'account';
    case '/my/profile':
      return 'profile';
    case '/my/settings':
      return 'settings';
    case '/my/security':
      return 'security';
    case '/my/posts':
      return 'posts';
    case '/my/series':
      return 'series';
    case '/my/works':
      return 'works';
    case '/my/artists':
      return 'artists';
    case '/my/forms':
      return 'forms';
    default:
      return 'account';
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await getRequestHeaders();
  const pathname = getRequestPathnameFromHeaders(headersList, '/my');
  const [settings, baseUrl, tCommonLabels, tCommonEntities, tMeta] = await Promise.all([
    getSettings(),
    getBaseUrl(),
    getTranslations('common.labels'),
    getTranslations('common.entities'),
    getTranslations('myMetadata'),
  ]);
  const siteName = settings.site_title || 'Site';
  const navigationKey = getMyNavigationKey(pathname);
  const title =
    navigationKey === 'account'
      ? tCommonLabels('account')
      : navigationKey === 'profile'
        ? tCommonLabels('profile')
        : navigationKey === 'security'
          ? tCommonLabels('security')
          : navigationKey === 'settings'
            ? tCommonLabels('settings')
            : navigationKey === 'posts'
              ? tCommonEntities('posts')
              : navigationKey === 'series'
                ? tCommonEntities('series')
                : navigationKey === 'works'
                  ? tCommonEntities('works')
                  : navigationKey === 'artists'
                    ? tCommonEntities('artists')
                    : tCommonEntities('forms');

  return withNoIndex(
    buildStaticOgMetadata({
      baseUrl,
      title,
      description: tMeta('description', { title, siteName }),
      path: pathname,
      siteName,
    }),
  );
}

export default async function MyLayout({ children }: { children: ReactNode }) {
  const headersList = await getRequestHeaders();
  const session = await getSession();

  if (!session?.user) {
    const currentPath = getRequestPathWithSearchFromHeaders(headersList, '/my');
    redirect(buildLoginRedirectHref(currentPath));
  }

  const pathname = getRequestPathnameFromHeaders(headersList, '/my');
  const segments = pathname.split('/').filter(Boolean);
  const section = segments[1] ?? 'profile';

  const sections: MySection[] = normalizeMySections(await getMySections());

  const allowedPaths = sections.map((item) => mySectionToPath(item)).filter((item): item is string => item !== null);

  if (!allowedPaths.includes(section)) {
    redirect(allowedPaths.length > 0 ? `/my/${allowedPaths[0]}` : '/');
  }

  return (
    <UserShell user={session.user} sections={sections}>
      {children}
    </UserShell>
  );
}
