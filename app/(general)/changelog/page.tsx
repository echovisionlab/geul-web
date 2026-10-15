import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ChangelogPageView } from '@/features/changelog/ChangelogPageView';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getChangelogReleases } from '@/lib/changelog/changelog';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { getRequestPathWithSearchFromHeaders } from '@/lib/utils/request-path';
import { getSession } from '@/lib/utils/session.server';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Recent product updates and fixes.',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

export default async function ChangelogPage() {
  const session = await getSession();

  if (!session?.user) {
    const headersList = await getRequestHeaders();
    const currentPath = getRequestPathWithSearchFromHeaders(headersList, '/changelog');
    redirect(buildLoginRedirectHref(currentPath));
  }

  if (session.user.role !== 'admin' && session.user.role !== 'author') {
    redirect('/');
  }

  const releases = await getChangelogReleases();
  return <ChangelogPageView releases={releases} />;
}
