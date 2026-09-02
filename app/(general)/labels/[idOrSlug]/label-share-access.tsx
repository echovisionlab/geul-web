'use server';

import type { ReactNode } from 'react';
import { getLabelPublic } from '@/lib/queries/label';
import { getBaseUrl } from '@/lib/utils/url.server';
import { LabelPublicContent } from './LabelPublicContent';

export interface LabelShareAccessState {
  content?: ReactNode;
  error?: 'incorrect_password' | 'not_found';
}

export async function accessLabelShareAction(
  _previousState: LabelShareAccessState,
  formData: FormData,
): Promise<LabelShareAccessState> {
  const token = String(formData.get('token') ?? '').trim();
  const idOrSlug = String(formData.get('idOrSlug') ?? '').trim();
  const requestedLocale = String(formData.get('requestedLocale') ?? '').trim() || null;
  const uiLocale = String(formData.get('uiLocale') ?? '').trim() || 'en';
  const password = String(formData.get('password') ?? '');
  if (!token || !idOrSlug || !password) {
    return { error: 'incorrect_password' };
  }

  const label = await getLabelPublic(idOrSlug, token, { requestedLocale, sharePassword: password });
  if (!label) {
    return { error: 'incorrect_password' };
  }
  return {
    content: await LabelPublicContent({
      label,
      labelMetadata: null,
      baseUrl: await getBaseUrl(),
      query: { share: token },
      requestedLocale,
      uiLocale,
    }),
  };
}
