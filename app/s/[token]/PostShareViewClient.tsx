'use client';

import { useActionState, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { SharePasswordView } from '@/features/share/SharePasswordView';
import { accessPostShareAction, type PostShareAccessState } from '@/lib/actions/post-share';
import { PostViewContent } from '@/features/post/PostViewContent';
import { toPostViewModel } from '@/features/post/post-view-model';

export function PostShareViewClient({
  token,
  idOrSlug,
  requestedLocale,
  initialState,
  passwordRequired,
}: {
  token: string;
  idOrSlug: string;
  requestedLocale: string;
  initialState: PostShareAccessState;
  passwordRequired: boolean;
}) {
  const t = useTranslations('postShareAccess');
  const [password, setPassword] = useState('');
  const [state, action, pending] = useActionState(accessPostShareAction, initialState);
  const [, startLocaleTransition] = useTransition();
  const activeRequestedLocale = state.requestedLocale ?? requestedLocale;

  const handleRequestedLocaleChange = (nextLocale: string) => {
    const formData = new FormData();
    formData.set('token', token);
    formData.set('idOrSlug', idOrSlug);
    formData.set('requestedLocale', nextLocale);
    formData.set('password', password);
    startLocaleTransition(() => action(formData));
  };

  if (state.post) {
    return (
      <PostViewContent
        post={toPostViewModel(state.post)}
        pathname={`/posts/${state.post.slug || state.post.id}`}
        query={{ share: token }}
        requestedLocale={activeRequestedLocale}
        allowedActions={state.allowedActions ?? []}
        sharePassword={passwordRequired ? password : undefined}
        onRequestedLocaleChange={passwordRequired ? handleRequestedLocaleChange : undefined}
      />
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="idOrSlug" value={idOrSlug} />
      <input type="hidden" name="requestedLocale" value={requestedLocale} />
      <SharePasswordView
        password={password}
        onPasswordChange={setPassword}
        pending={pending}
        error={state.error ? t(`errors.${state.error}`) : undefined}
        labels={{
          title: t('title'),
          description: t('description'),
          password: t('password'),
          submit: t('submit'),
        }}
      />
    </form>
  );
}
