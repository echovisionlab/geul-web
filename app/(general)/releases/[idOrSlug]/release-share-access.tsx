'use server';

import type { ReactNode } from 'react';
import { getReleasePublic } from '@/lib/queries/release';
import { ReleasePublicContent } from './ReleasePublicContent';

export interface ReleaseShareAccessState {
  content?: ReactNode;
  error?: 'incorrect_password' | 'not_found';
}

export async function accessReleaseShareAction(
  _previousState: ReleaseShareAccessState,
  formData: FormData,
): Promise<ReleaseShareAccessState> {
  const token = String(formData.get('token') ?? '').trim();
  const idOrSlug = String(formData.get('idOrSlug') ?? '').trim();
  const requestedLocale = String(formData.get('requestedLocale') ?? '').trim() || 'en';
  const uiLocale = String(formData.get('uiLocale') ?? '').trim() || requestedLocale;
  const password = String(formData.get('password') ?? '');
  if (!token || !idOrSlug || !password) {
    return { error: 'incorrect_password' };
  }

  try {
    const release = await getReleasePublic(idOrSlug, token, {
      requestedLocale,
      sharePassword: password,
    });
    if (!release) {
      return { error: 'not_found' };
    }
    return {
      content: await ReleasePublicContent({
        release,
        releaseMetadata: null,
        query: { share: token },
        requestedLocale,
        uiLocale,
        shareToken: token,
        sharePassword: password,
      }),
    };
  } catch {
    return { error: 'incorrect_password' };
  }
}
