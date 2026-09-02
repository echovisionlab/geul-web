import { notFound, redirect } from 'next/navigation';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { getRequestPathWithSearchFromHeaders } from '@/lib/utils/request-path';
import { getSession } from '@/lib/utils/session.server';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const session = await getSession();
  if (!session?.user) {
    const headers = await getRequestHeaders();
    redirect(buildLoginRedirectHref(getRequestPathWithSearchFromHeaders(headers, '/files')));
  }
  if (session.user.role !== 'admin') {
    notFound();
  }

  redirect('/admin/files');
}
