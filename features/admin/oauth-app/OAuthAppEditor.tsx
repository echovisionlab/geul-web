'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { notifications } from '@/components/core/Notification';
import {
  createSignInAppAction,
  deleteSignInAppAction,
  rotateSignInAppSecretAction,
  updateSignInAppAction,
} from '@/lib/actions/oauth-apps';
import {
  EMPTY_SIGN_IN_APP_DRAFT,
  type OAuthAppSecret,
  type OAuthMemberCriteriaOption,
  type OAuthSignInApp,
} from './model';
import { OAuthAppEditorView } from './OAuthAppEditorView';
import { OAUTH_APPS_PATH, oauthAppPath } from './paths';

export interface OAuthAppEditorProps {
  /** The stored app to edit; null creates one. */
  app: OAuthSignInApp | null;
  /** Member criteria that can admit Members. */
  memberCriteria: OAuthMemberCriteriaOption[];
}

/** Creates or edits a sign-in app and shows a newly issued secret once. */
export function OAuthAppEditor({ app, memberCriteria }: OAuthAppEditorProps) {
  const t = useTranslations('adminList.oauthApps');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [stored, setStored] = useState(app);
  const [draft, setDraft] = useState(app?.draft ?? EMPTY_SIGN_IN_APP_DRAFT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingCommand, setPendingCommand] = useState<'rotate' | 'delete' | null>(null);
  const [secret, setSecret] = useState<OAuthAppSecret | null>(null);
  // A secret shown after creating an app leads to the new app once the dialog closes.
  const [afterSecret, setAfterSecret] = useState<string | null>(null);
  // The picker also lists criteria the app still links, such as archived ones.
  const options = [
    ...memberCriteria,
    ...(stored?.memberCriteria ?? []).filter((linked) => !memberCriteria.some((option) => option.id === linked.id)),
  ];

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    if (!stored) {
      const result = await createSignInAppAction(draft);
      setSaving(false);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      if (result.secret) {
        setSecret({ clientId: result.clientId, value: result.secret });
        setAfterSecret(oauthAppPath(result.clientId));
        return;
      }
      router.replace(oauthAppPath(result.clientId));
      return;
    }
    const result = await updateSignInAppAction({ draft, revision: stored.revision });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setStored(result.app);
    setDraft(result.app.draft);
    notifications.show({ message: t('saved'), tone: 'positive' });
    if (result.secret) {
      setSecret({ clientId: result.app.draft.clientId, value: result.secret });
    }
  };

  const rotateSecret = async () => {
    if (!stored) {
      return false;
    }
    setPendingCommand('rotate');
    const result = await rotateSignInAppSecretAction({ clientId: stored.draft.clientId, revision: stored.revision });
    setPendingCommand(null);
    if (!result.ok) {
      notifications.show({ message: result.error, tone: 'danger' });
      return false;
    }
    setStored(result.app);
    setSecret({ clientId: result.app.draft.clientId, value: result.secret });
    return true;
  };

  const deleteApp = async () => {
    if (!stored) {
      return false;
    }
    setPendingCommand('delete');
    const result = await deleteSignInAppAction({ clientId: stored.draft.clientId, revision: stored.revision });
    setPendingCommand(null);
    if (!result.ok) {
      notifications.show({ message: result.error, tone: 'danger' });
      return false;
    }
    notifications.show({ message: t('deleted', { name: stored.draft.name }), tone: 'positive' });
    router.replace(OAUTH_APPS_PATH);
    return true;
  };

  const copySecret = (value: string) => {
    void navigator.clipboard.writeText(value).then(
      () => notifications.show({ message: tCommon('actions.copied'), tone: 'positive' }),
      () => notifications.show({ message: tCommon('errors.generic'), tone: 'danger' }),
    );
  };

  const closeSecret = () => {
    setSecret(null);
    if (afterSecret) {
      router.replace(afterSecret);
    }
  };

  return (
    <OAuthAppEditorView
      mode={stored ? 'edit' : 'create'}
      draft={draft}
      memberCriteria={options}
      createdAt={stored?.createdAt}
      saving={saving}
      saveError={saveError}
      pendingCommand={pendingCommand}
      secret={secret}
      backHref={OAUTH_APPS_PATH}
      onChange={setDraft}
      onSave={() => void save()}
      onRotateSecret={rotateSecret}
      onDelete={deleteApp}
      onCopySecret={copySecret}
      onCloseSecret={closeSecret}
    />
  );
}
