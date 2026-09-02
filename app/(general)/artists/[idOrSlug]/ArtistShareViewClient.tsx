'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SharePasswordView } from '@/features/share/SharePasswordView';
import { accessArtistShareAction, type ArtistShareAccessState } from './artist-share-access';

export function ArtistShareViewClient({
  token,
  idOrSlug,
  requestedLocale,
  uiLocale,
}: {
  token: string;
  idOrSlug: string;
  requestedLocale: string;
  uiLocale: string;
}) {
  const t = useTranslations('artistShareAccess');
  const [password, setPassword] = useState('');
  const [state, action, pending] = useActionState<ArtistShareAccessState, FormData>(accessArtistShareAction, {});
  if (state.content) {
    return state.content;
  }
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="idOrSlug" value={idOrSlug} />
      <input type="hidden" name="requestedLocale" value={requestedLocale} />
      <input type="hidden" name="uiLocale" value={uiLocale} />
      <SharePasswordView
        password={password}
        onPasswordChange={setPassword}
        pending={pending}
        error={state.error ? t(`errors.${state.error}`) : undefined}
        labels={{ title: t('title'), description: t('description'), password: t('password'), submit: t('submit') }}
      />
    </form>
  );
}
