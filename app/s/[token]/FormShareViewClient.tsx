'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SharePasswordView } from '@/features/share/SharePasswordView';
import { FormDashboardView } from '@/features/form/FormDashboardView';
import { PublicFormView } from '@/features/form/PublicFormView';
import { accessFormShareAction, type FormShareAccessState } from './form-share-access';

export function FormShareViewClient({
  token,
  idOrSlug,
  requestedLocale,
  target,
  initialState,
  passwordRequired,
}: {
  token: string;
  idOrSlug: string;
  requestedLocale: string;
  target: 'form' | 'dashboard';
  initialState: FormShareAccessState;
  passwordRequired: boolean;
}) {
  const t = useTranslations('pageShareAccess');
  const tCommon = useTranslations('common.actions');
  const [password, setPassword] = useState('');
  const [state, action, pending] = useActionState(accessFormShareAction, initialState);
  const sharePassword = passwordRequired ? password : undefined;

  if (target === 'dashboard' && state.granted) {
    return (
      <FormDashboardView
        slug={idOrSlug}
        shareToken={token}
        sharePassword={sharePassword}
        requestedLocale={requestedLocale}
      />
    );
  }
  if (target === 'form' && state.form) {
    return (
      <PublicFormView
        slug={idOrSlug}
        form={state.form}
        accessData={{ accessible: true, form: state.form }}
        requestedLocale={requestedLocale}
        previewShareToken={token}
        previewSharePassword={sharePassword}
      />
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="idOrSlug" value={idOrSlug} />
      <input type="hidden" name="requestedLocale" value={requestedLocale} />
      <input type="hidden" name="target" value={target} />
      <SharePasswordView
        password={password}
        onPasswordChange={setPassword}
        pending={pending}
        error={state.error ? t(`errors.${state.error}`) : undefined}
        labels={{
          title: t('title'),
          description: t('description'),
          password: t('password'),
          submit: tCommon('open'),
        }}
      />
    </form>
  );
}
