'use server';

import type { ReactNode } from 'react';
import { getPageViewWithToken } from '@/lib/queries/page';
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
    const page = await getPageViewWithToken(idOrSlug, token, requestedLocale, password);
    if (!page) {
      return { error: 'not_found' };
    }
    return {
      content: <PageShareContent page={page} token={token} password={password} requestedLocale={requestedLocale} />,
    };
  } catch {
    return { error: 'incorrect_password' };
  }
}
