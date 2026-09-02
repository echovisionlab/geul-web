'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { startPrivilegedReauthentication } from '@/features/auth/login-redirect';
import {
  createAccountPersonalAccessTokenAction,
  createMyPersonalAccessTokenAction,
  deleteAccountPersonalAccessTokenAction,
  deleteMyPersonalAccessTokenAction,
  regenerateAccountPersonalAccessTokenAction,
  regenerateMyPersonalAccessTokenAction,
  type PersonalAccessTokenActionError,
} from '@/lib/actions/personal-access-token';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import {
  consumePersonalAccessTokenContinuation,
  PERSONAL_ACCESS_TOKEN_CONTINUATION_PARAM,
  personalAccessTokenReauthenticationReturnTo,
  rememberPersonalAccessTokenContinuation,
  type PersonalAccessTokenContinuation,
} from './personal-access-token-reauthentication';
import type { PersonalAccessTokenSettingsItem } from './mcp-integration-access';
import {
  PersonalAccessTokenSettingsView,
  type PersonalAccessTokenSecretViewModel,
  type PersonalAccessTokenViewModel,
} from './ui/PersonalAccessTokenSettings';

interface PersonalAccessTokenSettingsProps {
  subjectId: string;
  initialPersonalAccessTokens: PersonalAccessTokenSettingsItem[];
  initialLoadFailed?: boolean;
  mode?: 'self' | 'admin';
}

type PendingAction = 'create' | `regenerate:${string}` | `delete:${string}` | null;

function mutationContinuation(
  action: 'regenerate' | 'delete',
  personalAccessTokenId: string,
): PersonalAccessTokenContinuation {
  return { action, id: personalAccessTokenId };
}

export function PersonalAccessTokenSettings({
  subjectId,
  initialPersonalAccessTokens,
  initialLoadFailed = false,
  mode = 'self',
}: PersonalAccessTokenSettingsProps) {
  return (
    <SubjectPersonalAccessTokenSettings
      key={`${mode}:${subjectId}`}
      subjectId={subjectId}
      initialPersonalAccessTokens={initialPersonalAccessTokens}
      initialLoadFailed={initialLoadFailed}
      mode={mode}
    />
  );
}

function SubjectPersonalAccessTokenSettings({
  subjectId,
  initialPersonalAccessTokens,
  initialLoadFailed = false,
  mode = 'self',
}: PersonalAccessTokenSettingsProps) {
  const dateTime = useDateTimeFormatter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('security.personalAccessTokens');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const [tokens, setTokens] = useState(initialPersonalAccessTokens);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [secret, setSecret] = useState<PersonalAccessTokenSecretViewModel | null>(null);
  const { copy } = useCopyToClipboard();

  useEffect(() => {
    setTokens(initialPersonalAccessTokens);
  }, [initialPersonalAccessTokens]);

  const token = useMemo<PersonalAccessTokenViewModel | null>(() => {
    const current = tokens[0];
    if (!current) {
      return null;
    }
    const createdAt = current.createdAt ? new Date(current.createdAt) : null;
    return {
      id: current.id,
      createdAtLabel:
        createdAt && !Number.isNaN(createdAt.getTime())
          ? dateTime.dateTime(createdAt, { dateStyle: 'medium', timeStyle: 'short' })
          : '—',
      canRegenerate: current.canRegenerate,
    };
  }, [dateTime, tokens]);

  const handleError = useCallback(
    (error: PersonalAccessTokenActionError | undefined, continuation: PersonalAccessTokenContinuation): void => {
      if (error === 'reauth_required') {
        rememberPersonalAccessTokenContinuation(continuation, subjectId);
        startPrivilegedReauthentication(personalAccessTokenReauthenticationReturnTo(pathname));
        return;
      }
      notifications.show({ message: t('requestFailed'), color: 'red' });
    },
    [pathname, subjectId, t],
  );

  const createToken = useCallback(async (): Promise<boolean> => {
    const continuation: PersonalAccessTokenContinuation = { action: 'create' };
    setPendingAction('create');
    try {
      const result =
        mode === 'admin'
          ? await createAccountPersonalAccessTokenAction(subjectId)
          : await createMyPersonalAccessTokenAction();
      if (!result.personalAccessToken || !result.secret) {
        handleError(result.error, continuation);
        return false;
      }
      setTokens([{ ...result.personalAccessToken, canRegenerate: true }]);
      setSecret({ value: result.secret });
      return true;
    } finally {
      setPendingAction(null);
    }
  }, [handleError, mode, subjectId]);

  const regenerateToken = useCallback(
    async (personalAccessTokenId: string): Promise<boolean> => {
      if (!token?.canRegenerate || token.id !== personalAccessTokenId) {
        return false;
      }
      const continuation = mutationContinuation('regenerate', personalAccessTokenId);
      setPendingAction(`regenerate:${personalAccessTokenId}`);
      try {
        const result =
          mode === 'admin'
            ? await regenerateAccountPersonalAccessTokenAction(subjectId, personalAccessTokenId)
            : await regenerateMyPersonalAccessTokenAction(personalAccessTokenId);
        if (!result.personalAccessToken || !result.secret) {
          handleError(result.error, continuation);
          return false;
        }
        setTokens([{ ...result.personalAccessToken, canRegenerate: true }]);
        setSecret({ value: result.secret });
        return true;
      } finally {
        setPendingAction(null);
      }
    },
    [handleError, mode, subjectId, token],
  );

  const deleteToken = useCallback(
    async (personalAccessTokenId: string): Promise<boolean> => {
      const continuation = mutationContinuation('delete', personalAccessTokenId);
      setPendingAction(`delete:${personalAccessTokenId}`);
      try {
        const result =
          mode === 'admin'
            ? await deleteAccountPersonalAccessTokenAction(subjectId, personalAccessTokenId)
            : await deleteMyPersonalAccessTokenAction(personalAccessTokenId);
        if (!result.deleted) {
          handleError(result.error, continuation);
          return false;
        }
        setTokens([]);
        return true;
      } finally {
        setPendingAction(null);
      }
    },
    [handleError, mode, subjectId],
  );

  useEffect(() => {
    if (searchParams.get(PERSONAL_ACCESS_TOKEN_CONTINUATION_PARAM) !== '1') {
      return;
    }
    const continuation = consumePersonalAccessTokenContinuation(subjectId);
    window.history.replaceState(window.history.state, '', pathname);
    if (!continuation) {
      return;
    }
    switch (continuation.action) {
      case 'create':
        void createToken();
        break;
      case 'regenerate':
        void regenerateToken(continuation.id);
        break;
      case 'delete':
        void deleteToken(continuation.id);
        break;
    }
  }, [createToken, deleteToken, pathname, regenerateToken, searchParams, subjectId]);

  return (
    <PersonalAccessTokenSettingsView
      token={token}
      loadFailed={initialLoadFailed}
      pendingAction={pendingAction}
      secret={secret}
      labels={{
        title: t('title'),
        description: t('description'),
        empty: t('empty'),
        created: tCommonLabels('created'),
        create: tCommonActions('create'),
        regenerate: t('regenerate'),
        delete: tCommonActions('delete'),
        copy: tCommonActions('copy'),
        cancel: tCommonActions('cancel'),
        close: tCommonActions('close'),
        regenerateTitle: t('regenerateTitle'),
        regenerateConfirmation: t('regenerateConfirmation'),
        deleteTitle: t('deleteTitle'),
        deleteConfirmation: t('deleteConfirmation'),
        oneTimeTitle: t('oneTimeTitle'),
        oneTimeWarning: t('oneTimeWarning'),
        secret: t('secret'),
        loadFailed: t('loadFailed'),
      }}
      onCreate={createToken}
      onRegenerate={regenerateToken}
      onDelete={deleteToken}
      onCopySecret={(value) =>
        copy(value, {
          successMessage: t('copySuccess'),
          errorMessage: t('copyFailed'),
        })
      }
      onCloseSecret={() => setSecret(null)}
    />
  );
}
