'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LegalShareDocumentView } from '@/features/policy/LegalShareDocumentView';
import { SharePasswordView } from '@/features/share/SharePasswordView';
import { accessLegalShareAction, type LegalShareAccessState } from './legal-share-access';

export function LegalShareViewClient({
  entityType,
  entityId,
  token,
  requestedLocale,
  initialState,
}: {
  entityType: 'privacy' | 'terms';
  entityId: string;
  token: string;
  requestedLocale: string;
  initialState: LegalShareAccessState;
}) {
  const t = useTranslations('postShareAccess');
  const tActions = useTranslations('common.actions');
  const tLegalPage = useTranslations('legalPageCommon');
  const [password, setPassword] = useState('');
  const [state, action, pending] = useActionState(accessLegalShareAction, initialState);

  if (state.document) {
    return <LegalShareDocumentView document={state.document} pathname={`/s/${token}`} />;
  }

  return (
    <form action={action}>
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="id" value={entityId} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="requestedLocale" value={requestedLocale} />
      <SharePasswordView
        password={password}
        onPasswordChange={setPassword}
        pending={pending}
        error={state.error ? tLegalPage('preview.invalid') : undefined}
        labels={{
          title: t('title'),
          description: t('description'),
          password: t('password'),
          submit: tActions('open'),
        }}
      />
    </form>
  );
}
