'use server';

import type { ReactNode } from 'react';
import { getPageAccessViewWithToken } from '@/lib/queries/page';
import { PageRestrictedAccess } from '@/features/page/PageRestrictedAccess';
import { PageShareContent } from './PageShareContent';

export interface PageShareAccessState {
  content?: ReactNode;
  error?: 'incorrect_password' | 'not_found';
}

export async function accessPageShareAction(
  _previousState: PageShareAccessState,
  formData: FormData,
): Promise<PageShareAccessState> {
  const token = String(formData.get('token') ?? '').trim();
  const idOrSlug = String(formData.get('idOrSlug') ?? '').trim();
  const requestedLocale = String(formData.get('requestedLocale') ?? '').trim() || 'en';
  const password = String(formData.get('password') ?? '');
  if (!token || !idOrSlug || !password) {
    return { error: 'incorrect_password' };
  }

  try {
    const access = await getPageAccessViewWithToken(idOrSlug, token, requestedLocale, password);
    if (!access) {
      return { error: 'not_found' };
    }
    if (access.reason !== 'allowed') {
      return { content: <PageRestrictedAccess reason={access.reason} returnTo={`/s/${encodeURIComponent(token)}`} /> };
    }
    const page = access.page;
    return {
      content: <PageShareContent page={page} token={token} password={password} requestedLocale={requestedLocale} />,
    };
  } catch {
    return { error: 'incorrect_password' };
  }
}
