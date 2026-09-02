'use server';

import type { ReactNode } from 'react';
import { getArtistView } from '@/lib/queries/artist';
import { getBaseUrl } from '@/lib/utils/url.server';
import { ArtistPublicContent } from './ArtistPublicContent';

export interface ArtistShareAccessState {
  content?: ReactNode;
  error?: 'incorrect_password' | 'not_found';
}

export async function accessArtistShareAction(
  _previousState: ArtistShareAccessState,
  formData: FormData,
): Promise<ArtistShareAccessState> {
  const token = String(formData.get('token') ?? '').trim();
  const idOrSlug = String(formData.get('idOrSlug') ?? '').trim();
  const requestedLocale = String(formData.get('requestedLocale') ?? '').trim() || null;
  const uiLocale = String(formData.get('uiLocale') ?? '').trim() || 'en';
  const password = String(formData.get('password') ?? '');
  if (!token || !idOrSlug || !password) {
    return { error: 'incorrect_password' };
  }

  const artist = await getArtistView(idOrSlug, { requestedLocale, shareToken: token, sharePassword: password });
  if (!artist) {
    return { error: 'incorrect_password' };
  }
  return {
    content: await ArtistPublicContent({
      artist,
      artistMetadata: null,
      baseUrl: await getBaseUrl(),
      query: { share: token },
      requestedLocale,
      uiLocale,
    }),
  };
}
