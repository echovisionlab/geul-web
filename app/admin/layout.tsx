import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/features/admin/AdminShell/AdminShell';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getSettings } from '@/lib/queries/manifest';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { buildStaticOgMetadata } from '@/lib/utils/og';
import { getRequestPathnameFromHeaders, getRequestPathWithSearchFromHeaders } from '@/lib/utils/request-path';
import { resolveAdminRouteMetadata, withNoIndex } from '@/lib/utils/route-metadata';
import { getSession, isAdmin } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await getRequestHeaders();
  const [settings, baseUrl] = await Promise.all([getSettings(), getBaseUrl()]);
  const siteName = settings.site_title || 'Site';
  const route = resolveAdminRouteMetadata(getRequestPathnameFromHeaders(headersList, '/admin'), siteName);

  return withNoIndex(
    buildStaticOgMetadata({
      baseUrl,
      title: route.title,
      description: route.description,
      path: route.path,
      siteName,
    }),
  );
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session?.user) {
    const headersList = await getRequestHeaders();
    const currentPath = getRequestPathWithSearchFromHeaders(headersList, '/admin');
    redirect(buildLoginRedirectHref(currentPath));
  }

  if (!(await isAdmin())) {
    redirect('/');
  }

  return <AdminShell>{children}</AdminShell>;
}
