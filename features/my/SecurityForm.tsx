'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { SectionHeader } from '@/components/core/Section';
import { AccountEmailProviderLogo } from '@/features/account-email/AccountEmailOption';
import { clearAuthRedirect, startPrivilegedReauthentication } from '@/features/auth/login-redirect';
import {
  ACCOUNT_SECURITY_CONTINUATION_PARAM,
  accountSecurityReauthenticationReturnTo,
  consumeAccountSecurityContinuation,
  rememberAccountSecurityContinuation,
} from '@/features/auth/security-reauthentication';
import { requestAccountDeletionAction } from '@/lib/actions/account';
import {
  getConnectedProvidersAction,
  revokeMyOtherSessionsAction,
  revokeMySessionAction,
  type ConnectedProvider,
} from '@/lib/actions/identity';
import { useLocale } from '@/lib/providers/LocaleProvider';
import { getPublicAuthUrl } from '@/lib/public-runtime-config';
import type { SessionInfo } from '@/lib/types/user/model';
import type { OidcProvider } from '@/lib/types/identity/provider';
import { getSettingsFlowCsrfToken, type SettingsFlow } from '@/features/auth/settings-flow';
import { PasskeySettingsSection } from './PasskeySettingsSection';
import { AccountEmailSettingsView } from './ui/AccountEmailSettings';
import { ConnectedSocialAccountsView } from './ui/ConnectedSocialAccounts';
import { SessionManagementView } from './ui/SessionManagement';

const ALL_PROVIDERS: OidcProvider[] = ['google', 'github'];
const ACCOUNT_EXISTS_ERROR_ID = 4000007;
const LINK_FLOW_ATTEMPT_KEY = 'oidc_link_attempt';
const PENDING_LINK_PROVIDER_KEY = 'oidc_pending_provider';
const UNLINK_FLOW_ATTEMPT_KEY = 'oidc_unlink_attempt';
const PENDING_UNLINK_PROVIDER_KEY = 'oidc_pending_unlink_provider';
const FLOW_HANDLED_SUFFIX = ':handled';
export interface SecurityFormBindings {
  getConnectedProvidersAction: typeof getConnectedProvidersAction;
  revokeMyOtherSessionsAction: typeof revokeMyOtherSessionsAction;
  revokeMySessionAction: typeof revokeMySessionAction;
  requestAccountDeletionAction: typeof requestAccountDeletionAction;
}
const defaultBindings: SecurityFormBindings = {
  getConnectedProvidersAction,
  revokeMyOtherSessionsAction,
  revokeMySessionAction,
  requestAccountDeletionAction,
};
interface SecurityFormProps {
  subjectId: string;
  bindings?: SecurityFormBindings;
  availableMethods?: Partial<Record<'socialConnections' | 'passkeys' | 'accountDeletion', boolean>>;
  requestPasskeyFlow?: import('react').ComponentProps<typeof PasskeySettingsSection>['requestFlow'];
  initialSessions: SessionInfo[];
  initialProviders: ConnectedProvider[];
  initialCanonicalEmail?: string;
  initialEmailCodeAvailable?: boolean;
  initialPasskeyCount?: number;
  initialFlowId?: string | null;
  initialLinkProviderParam?: string | null;
  initialUnlinkProviderParam?: string | null;
}

interface KratosUiMessage {
  id?: number | string;
  type?: string;
  text?: string;
}

function isOidcProvider(value: string | null | undefined): value is OidcProvider {
  return value === 'google' || value === 'github';
}

function getPendingProviderFromStorage(storageKey: string): OidcProvider | null {
  const value = sessionStorage.getItem(storageKey);
  return isOidcProvider(value) ? value : null;
}

function clearFlowState(attemptKey: string, handledKey: string, pendingProviderKey: string): void {
  sessionStorage.setItem(handledKey, '1');
  sessionStorage.removeItem(attemptKey);
  sessionStorage.removeItem(pendingProviderKey);
}

function submitOidcSettingsForm(
  flowId: string,
  provider: OidcProvider,
  mode: 'link' | 'unlink',
  csrfToken: string | null,
): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${getPublicAuthUrl()}/self-service/settings?flow=${encodeURIComponent(flowId)}`;
  form.style.display = 'none';

  const appendInput = (name: string, value: string) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  appendInput('method', 'oidc');
  appendInput(mode, provider);
  if (csrfToken) {
    appendInput('csrf_token', csrfToken);
  }

  document.body.appendChild(form);
  form.submit();
}

function getProviderName(provider: OidcProvider, tProviders: ReturnType<typeof useTranslations>): string {
  const translateProvider = tProviders as unknown as (key: OidcProvider) => string;
  return translateProvider(provider);
}

function formatLinkErrorMessage(
  provider: OidcProvider,
  message: KratosUiMessage,
  t: ReturnType<typeof useTranslations>,
  tProviders: ReturnType<typeof useTranslations>,
): string {
  const text = message.text?.trim();
  const providerName = getProviderName(provider, tProviders);
  const translate = t as unknown as (key: string, values?: Record<string, string>) => string;
  if (message.id === ACCOUNT_EXISTS_ERROR_ID) {
    return translate('providerErrors.accountAlreadyConnected', { provider: providerName });
  }

  const normalized = (text || '').toLowerCase();
  if (normalized.includes('access denied') || normalized.includes('canceled')) {
    return translate('providerErrors.signInCanceled', { provider: providerName });
  }

  if (normalized.includes('already')) {
    return translate('providerErrors.alreadyLinkedElsewhere', { provider: providerName });
  }

  return translate('providerErrors.connectFailed');
}

function formatUnlinkErrorMessage(
  provider: OidcProvider,
  message: KratosUiMessage,
  t: ReturnType<typeof useTranslations>,
  tProviders: ReturnType<typeof useTranslations>,
): string {
  const text = message.text?.trim();
  const normalized = (text || '').toLowerCase();
  const translate = t as unknown as (key: string, values?: Record<string, string>) => string;

  if (
    normalized.includes('account email') ||
    normalized.includes('canonical email') ||
    normalized.includes('primary email')
  ) {
    return translate('providerErrors.primaryEmailRequired');
  }

  if (normalized.includes('last') || normalized.includes('authentication method')) {
    return translate('providerErrors.mustKeepMethod');
  }

  return translate('providerErrors.disconnectFailed', { provider: getProviderName(provider, tProviders) });
}

export function SecurityForm({
  subjectId,
  bindings = defaultBindings,
  availableMethods = {},
  requestPasskeyFlow,
  initialSessions,
  initialProviders,
  initialCanonicalEmail = '',
  initialEmailCodeAvailable = false,
  initialFlowId = null,
  initialLinkProviderParam = null,
  initialUnlinkProviderParam = null,
}: SecurityFormProps) {
  const tModalActions = useTranslations('common.actions');
  const t = useTranslations('security');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonProviders = useTranslations('common.providers');
  const tCommonStates = useTranslations('common.states');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [canonicalEmail, setCanonicalEmail] = useState(initialCanonicalEmail);
  const [emailCodeAvailable, setEmailCodeAvailable] = useState(initialEmailCodeAvailable);

  // Connected Accounts state
  const [connectedProviders, setConnectedProviders] = useState<ConnectedProvider[]>(initialProviders);
  const [unlinkingProvider, setUnlinkingProvider] = useState<OidcProvider | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<OidcProvider | null>(null);

  // Delete account state
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deletionRequested, setDeletionRequested] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>(initialSessions);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokeOthersLoading, setRevokeOthersLoading] = useState(false);

  const sessionMutation = useRef(false);
  const currentSessionId = sessions.find((item) => item.current)?.id;
  const connectedProviderIds = connectedProviders.map((p) => p.provider);
  const availableProviders = ALL_PROVIDERS.filter((p) => !connectedProviderIds.includes(p));
  const totalRecoverableCredentials = connectedProviders.length + (emailCodeAvailable ? 1 : 0);
  const providerUnlinkBlockedReason = useCallback(
    (_provider: OidcProvider): 'last_method' | 'primary_email' | undefined => {
      if (totalRecoverableCredentials <= 1) {
        return 'last_method';
      }
      return undefined;
    },
    [totalRecoverableCredentials],
  );

  const applySecurityResult = useCallback((result: Awaited<ReturnType<typeof getConnectedProvidersAction>>) => {
    setConnectedProviders(result.providers);
    setCanonicalEmail(result.canonicalEmail);
    setEmailCodeAvailable(result.emailCodeAvailable);
  }, []);

  // Connected Accounts handlers
  const handleLinkProvider = (provider: OidcProvider) => {
    if (linkingProvider || unlinkingProvider) {
      return;
    }
    setLinkingProvider(provider);
    sessionStorage.removeItem(PENDING_UNLINK_PROVIDER_KEY);
    sessionStorage.setItem(PENDING_LINK_PROVIDER_KEY, provider);
    // The identity settings flow returns here so this page can continue provider linking.
    const returnTo = `/my/security?link_provider=${provider}`;
    window.location.href = `${getPublicAuthUrl()}/self-service/settings/browser?return_to=${encodeURIComponent(returnTo)}&provider=${provider}`;
  };

  const handleUnlinkProvider = (provider: OidcProvider) => {
    if (linkingProvider || unlinkingProvider) {
      return;
    }
    const blockedReason = providerUnlinkBlockedReason(provider);
    if (blockedReason) {
      notifications.show({
        title: t('notifications.cannotUnlink'),
        message:
          blockedReason === 'primary_email'
            ? t('providerErrors.primaryEmailRequired')
            : t('providerErrors.mustKeepMethod'),
        tone: 'warning',
      });
      return;
    }

    setUnlinkingProvider(provider);
    sessionStorage.removeItem(PENDING_LINK_PROVIDER_KEY);
    sessionStorage.setItem(PENDING_UNLINK_PROVIDER_KEY, provider);
    const returnTo = `/my/security?unlink_provider=${provider}`;
    window.location.href = `${getPublicAuthUrl()}/self-service/settings/browser?return_to=${encodeURIComponent(returnTo)}`;
  };

  const handleRevokeSession = useCallback(
    async (sessionId: string) => {
      if (sessionMutation.current) {
        return;
      }
      sessionMutation.current = true;
      setRevokingSessionId(sessionId);
      try {
        const result = await bindings.revokeMySessionAction(sessionId);
        if (result.error === 'reauth_required') {
          rememberAccountSecurityContinuation({ action: 'revoke_session', id: sessionId }, subjectId);
          startPrivilegedReauthentication(accountSecurityReauthenticationReturnTo());
          return;
        }
        if (result.error) {
          throw new Error(t('notifications.failedToRevokeSession'));
        }

        setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        router.refresh();
        notifications.show({
          message: t('notifications.sessionRevoked'),
          tone: 'positive',
        });
      } catch (error) {
        notifications.show({
          title: tCommonLabels('error'),
          message: error instanceof Error ? error.message : t('notifications.failedToRevokeSession'),
          tone: 'danger',
        });
      } finally {
        sessionMutation.current = false;
        setRevokingSessionId(null);
      }
    },
    [router, subjectId, t, tCommonLabels],
  );

  const handleRevokeOtherSessions = useCallback(async () => {
    if (sessionMutation.current) {
      return;
    }
    sessionMutation.current = true;
    setRevokeOthersLoading(true);
    try {
      const result = await bindings.revokeMyOtherSessionsAction();
      if (result.error === 'reauth_required') {
        rememberAccountSecurityContinuation({ action: 'revoke_other_sessions' }, subjectId);
        startPrivilegedReauthentication(accountSecurityReauthenticationReturnTo());
        return;
      }
      if (result.error) {
        throw new Error(t('notifications.failedToRevokeSessions'));
      }

      setSessions((prev) => prev.filter((session) => session.id === currentSessionId));
      router.refresh();
      notifications.show({
        message: t('notifications.sessionsRevoked'),
        tone: 'positive',
      });
    } catch (error) {
      notifications.show({
        title: tCommonLabels('error'),
        message: error instanceof Error ? error.message : t('notifications.failedToRevokeSessions'),
        tone: 'danger',
      });
    } finally {
      sessionMutation.current = false;
      setRevokeOthersLoading(false);
    }
  }, [currentSessionId, router, subjectId, t, tCommonLabels]);

  const handleOpenDeleteModal = () => {
    setDeletionRequested(false);
    openDeleteModal();
  };

  const handleRequestAccountDeletion = useCallback(async () => {
    setDeleteLoading(true);
    try {
      const result = await bindings.requestAccountDeletionAction();
      if (result.error === 'reauth_required') {
        rememberAccountSecurityContinuation({ action: 'request_account_deletion' }, subjectId);
        startPrivilegedReauthentication(accountSecurityReauthenticationReturnTo());
        return;
      }
      if (result.success) {
        setDeletionRequested(true);
        notifications.show({
          title: t('notifications.confirmationEmailSent'),
          message: result.message,
          tone: 'positive',
        });
      } else {
        notifications.show({
          title: tCommonLabels('error'),
          message: result.message || t('notifications.failedToRequestDeletion'),
          tone: 'danger',
        });
      }
    } catch {
      notifications.show({
        title: tCommonLabels('error'),
        message: t('notifications.failedToRequestDeletion'),
        tone: 'danger',
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [subjectId, t, tCommonLabels]);

  useEffect(() => {
    if (searchParams.get(ACCOUNT_SECURITY_CONTINUATION_PARAM) !== '1') {
      return;
    }
    const continuation = consumeAccountSecurityContinuation(subjectId);
    window.history.replaceState(window.history.state, '', '/my/security');
    if (!continuation) {
      return;
    }

    switch (continuation.action) {
      case 'revoke_session':
        void handleRevokeSession(continuation.id);
        break;
      case 'revoke_other_sessions':
        void handleRevokeOtherSessions();
        break;
      case 'request_account_deletion':
        openDeleteModal();
        void handleRequestAccountDeletion();
        break;
    }
  }, [
    handleRequestAccountDeletion,
    handleRevokeOtherSessions,
    handleRevokeSession,
    openDeleteModal,
    searchParams,
    subjectId,
  ]);

  const flowId = searchParams.get('flow') ?? initialFlowId;
  const linkProviderParam = searchParams.get('link_provider') ?? initialLinkProviderParam;
  const unlinkProviderParam = searchParams.get('unlink_provider') ?? initialUnlinkProviderParam;
  const pendingLinkProvider = isOidcProvider(linkProviderParam) ? linkProviderParam : null;
  const pendingUnlinkProvider = isOidcProvider(unlinkProviderParam) ? unlinkProviderParam : null;

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    setCanonicalEmail(initialCanonicalEmail);
  }, [initialCanonicalEmail]);

  useEffect(() => {
    clearAuthRedirect();
  }, []);

  useEffect(() => {
    if (!flowId) {
      return;
    }

    const provider = pendingLinkProvider ?? getPendingProviderFromStorage(PENDING_LINK_PROVIDER_KEY);

    if (!provider) {
      return;
    }

    const attemptKey = `${LINK_FLOW_ATTEMPT_KEY}:${flowId}:${provider}`;
    const handledKey = `${attemptKey}${FLOW_HANDLED_SUFFIX}`;

    if (sessionStorage.getItem(handledKey) === '1') {
      return;
    }

    let active = true;
    const continueOidcLink = async () => {
      setLinkingProvider(provider);

      try {
        const flowRes = await fetch(`${getPublicAuthUrl()}/self-service/settings/flows?id=${flowId}`, {
          credentials: 'include',
        });

        if (!active) {
          return;
        }
        if (!flowRes.ok) {
          throw new Error(t('providerErrors.connectFailed'));
        }

        const flow = (await flowRes.json()) as SettingsFlow;
        if (!active) {
          return;
        }
        const accountExistsMessage = flow.ui?.messages?.find((message) => message.id === ACCOUNT_EXISTS_ERROR_ID);
        const firstError = accountExistsMessage ?? flow.ui?.messages?.find((message) => message.type === 'error');

        if (firstError) {
          notifications.show({
            title: t('notifications.connectionFailed'),
            message: formatLinkErrorMessage(provider, firstError, t, tCommonProviders),
            tone: 'danger',
          });
          clearFlowState(attemptKey, handledKey, PENDING_LINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        const connectedResult = await bindings.getConnectedProvidersAction();
        if (!active) {
          return;
        }
        if (!connectedResult.error && connectedResult.providers.some((connected) => connected.provider === provider)) {
          applySecurityResult(connectedResult);
          notifications.show({
            message: tCommonStates('connected'),
            tone: 'positive',
          });
          clearFlowState(attemptKey, handledKey, PENDING_LINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        if (sessionStorage.getItem(attemptKey) === '1') {
          notifications.show({
            title: t('notifications.connectionFailed'),
            message: t('providerErrors.connectFailed'),
            tone: 'danger',
          });
          clearFlowState(attemptKey, handledKey, PENDING_LINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        sessionStorage.setItem(attemptKey, '1');
        submitOidcSettingsForm(flowId, provider, 'link', getSettingsFlowCsrfToken(flow));
      } catch {
        if (!active) {
          return;
        }
        notifications.show({
          title: tCommonLabels('error'),
          message: t('providerErrors.connectFailed'),
          tone: 'danger',
        });
        clearFlowState(attemptKey, handledKey, PENDING_LINK_PROVIDER_KEY);
        router.replace('/my/security');
      } finally {
        if (active) {
          setLinkingProvider(null);
        }
      }
    };

    void continueOidcLink();
    return () => {
      active = false;
    };
  }, [applySecurityResult, flowId, pendingLinkProvider, subjectId, router, t, tCommonLabels, tCommonProviders]);

  useEffect(() => {
    if (!flowId) {
      return;
    }

    const provider = pendingUnlinkProvider ?? getPendingProviderFromStorage(PENDING_UNLINK_PROVIDER_KEY);

    if (!provider) {
      return;
    }

    const attemptKey = `${UNLINK_FLOW_ATTEMPT_KEY}:${flowId}:${provider}`;
    const handledKey = `${attemptKey}${FLOW_HANDLED_SUFFIX}`;

    if (sessionStorage.getItem(handledKey) === '1') {
      return;
    }

    if (providerUnlinkBlockedReason(provider)) {
      clearFlowState(attemptKey, handledKey, PENDING_UNLINK_PROVIDER_KEY);
      router.replace('/my/security');
      return;
    }

    let active = true;
    const continueOidcUnlink = async () => {
      setUnlinkingProvider(provider);

      try {
        const flowRes = await fetch(`${getPublicAuthUrl()}/self-service/settings/flows?id=${flowId}`, {
          credentials: 'include',
        });

        if (!active) {
          return;
        }
        if (!flowRes.ok) {
          throw new Error(
            t('providerErrors.disconnectFailed', {
              provider: getProviderName(provider, tCommonProviders),
            }),
          );
        }

        const flow = (await flowRes.json()) as SettingsFlow;
        if (!active) {
          return;
        }
        const firstError = flow.ui?.messages?.find((message) => message.type === 'error');

        if (firstError) {
          notifications.show({
            title: t('notifications.disconnectionFailed'),
            message: formatUnlinkErrorMessage(provider, firstError, t, tCommonProviders),
            tone: 'danger',
          });
          clearFlowState(attemptKey, handledKey, PENDING_UNLINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        const connectedResult = await bindings.getConnectedProvidersAction();
        if (!active) {
          return;
        }
        if (!connectedResult.error) {
          applySecurityResult(connectedResult);
        }

        if (!connectedResult.error && !connectedResult.providers.some((p) => p.provider === provider)) {
          notifications.show({
            message: t('notifications.disconnected'),
            tone: 'positive',
          });
          clearFlowState(attemptKey, handledKey, PENDING_UNLINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        if (sessionStorage.getItem(attemptKey) === '1') {
          notifications.show({
            title: t('notifications.disconnectionFailed'),
            message: t('providerErrors.disconnectFailed', {
              provider: getProviderName(provider, tCommonProviders),
            }),
            tone: 'danger',
          });
          clearFlowState(attemptKey, handledKey, PENDING_UNLINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }
        sessionStorage.setItem(attemptKey, '1');
        submitOidcSettingsForm(flowId, provider, 'unlink', getSettingsFlowCsrfToken(flow));
      } catch {
        if (!active) {
          return;
        }
        notifications.show({
          title: tCommonLabels('error'),
          message: t('providerErrors.disconnectFailed', {
            provider: getProviderName(provider, tCommonProviders),
          }),
          tone: 'danger',
        });
        clearFlowState(attemptKey, handledKey, PENDING_UNLINK_PROVIDER_KEY);
        router.replace('/my/security');
      } finally {
        if (active) {
          setUnlinkingProvider(null);
        }
      }
    };

    void continueOidcUnlink();
    return () => {
      active = false;
    };
  }, [
    applySecurityResult,
    flowId,
    pendingUnlinkProvider,
    subjectId,
    providerUnlinkBlockedReason,
    router,
    t,
    tCommonLabels,
    tCommonProviders,
  ]);

  return (
    <DsLayoutStack gap="xl">
      <AccountEmailSettingsView
        email={canonicalEmail}
        emailCodeAvailable={emailCodeAvailable}
        onChangeEmail={() => router.push('/verify')}
        labels={{
          canonical: t('email.canonical'),
          change: t('email.changeAction'),
          emailCode: t('email.sources.emailCode'),
          title: t('email.title'),
        }}
      />

      {availableMethods.socialConnections !== false ? (
        <ConnectedSocialAccountsView
          availableProviders={availableProviders}
          connectedProviders={connectedProviderIds}
          labels={{
            connect: tCommonActions('connect'),
            connected: tCommonStates('connected'),
            disconnect: tCommonActions('disconnect'),
            lastMethod: t('providerErrors.mustKeepMethod'),
            notConnected: tCommonStates('notConnected'),
            primaryEmailRequired: t('providerErrors.primaryEmailRequired'),
            providerName: (provider) => getProviderName(provider, tCommonProviders),
            title: t('connectedAccounts.title'),
          }}
          linkingProvider={linkingProvider}
          onLink={(provider) => void handleLinkProvider(provider)}
          onUnlink={(provider) => void handleUnlinkProvider(provider)}
          providerIcon={(provider) => <AccountEmailProviderLogo provider={provider} />}
          unlinkBlockedReasons={Object.fromEntries(
            connectedProviderIds.map((provider) => [provider, providerUnlinkBlockedReason(provider)]),
          )}
          unlinkingProvider={unlinkingProvider}
        />
      ) : null}

      {availableMethods.passkeys !== false ? (
        <PasskeySettingsSection
          requestFlow={requestPasskeyFlow}
          subjectId={subjectId}
          hasRecoverableAuthenticationMethod={totalRecoverableCredentials > 0}
        />
      ) : null}

      <SessionManagementView
        currentSessionId={currentSessionId}
        labels={{
          activeNow: t('sessions.activeNow'),
          browser: (browser) => (browser === 'unknown' ? tCommonStates('unknown') : t(`sessions.browser.${browser}`)),
          device: (device) => (device === 'unknown' ? tCommonStates('unknown') : t(`sessions.device.${device}`)),
          logOutOthers: t('sessions.logoutOthers'),
          os: (os) => (os === 'unknown' ? tCommonStates('unknown') : t(`sessions.os.${os}`)),
          revoke: t('sessions.revoke'),
          thisDevice: t('sessions.thisDevice'),
          title: t('sessions.title'),
        }}
        locale={locale}
        onRevokeOtherSessions={() => void handleRevokeOtherSessions()}
        onRevokeSession={(sessionId) => void handleRevokeSession(sessionId)}
        revokingSessionId={revokingSessionId}
        revokeOthersLoading={revokeOthersLoading}
        sessions={sessions.map((session) => {
          const device = session.devices?.[0];
          return {
            id: session.id,
            active: session.active,
            authenticatedAt: session.authenticated_at,
            device: device
              ? {
                  ipAddress: device.ip_address,
                  userAgent: device.user_agent,
                }
              : undefined,
          };
        })}
      />

      {availableMethods.accountDeletion !== false ? (
        <DsLayoutStack gap="md">
          <SectionHeader
            title={
              <DsText as="span" size="sm" weight="strong" tone="danger" role="heading" aria-level={2}>
                {t('dangerZone.title')}
              </DsText>
            }
          />

          <Alert tone="danger">
            <DsText size="sm">{t('dangerZone.alert')}</DsText>
          </Alert>

          <Button
            tone="danger"
            emphasis="medium"
            onClick={handleOpenDeleteModal}
            data-testid="security-request-account-deletion"
          >
            {tCommonActions('requestAccountDeletion')}
          </Button>
        </DsLayoutStack>
      ) : null}

      {availableMethods.accountDeletion !== false ? (
        <ContentModal
          opened={deleteModalOpened}
          loading={deleteLoading}
          onClose={closeDeleteModal}
          title={tCommonActions('requestAccountDeletion')}
          centered
          closeLabel={tModalActions('close')}
        >
          <DsLayoutStack gap="md">
            {deletionRequested ? (
              <>
                <Alert tone="positive">
                  <DsText size="sm">{t('dangerZone.requestedAlert')}</DsText>
                </Alert>
                <SupportingText tone="secondary">{t('dangerZone.requestedHelper')}</SupportingText>
                <DialogActions>
                  <Button tone="neutral" emphasis="medium" onClick={closeDeleteModal} disabled={deleteLoading}>
                    {tCommonActions('close')}
                  </Button>
                </DialogActions>
              </>
            ) : (
              <>
                <Alert tone="warning" icon={<IconAlertTriangle />}>
                  <DsText size="sm">{t('dangerZone.pendingIntro')}</DsText>
                  <DsLayoutStack as="ul" gap="xxs">
                    <DsText as="li" size="sm">
                      {t('dangerZone.pendingItems.logout')}
                    </DsText>
                    <DsText as="li" size="sm">
                      {t('dangerZone.pendingItems.recover')}
                    </DsText>
                    <DsText as="li" size="sm">
                      {t('dangerZone.pendingItems.anonymous')}
                    </DsText>
                  </DsLayoutStack>
                </Alert>

                <DialogActions>
                  <Button tone="neutral" emphasis="medium" onClick={closeDeleteModal} disabled={deleteLoading}>
                    {tCommonActions('cancel')}
                  </Button>
                  <Button
                    emphasis="strong"
                    tone="danger"
                    onClick={handleRequestAccountDeletion}
                    loading={deleteLoading}
                  >
                    {tCommonActions('sendConfirmationEmail')}
                  </Button>
                </DialogActions>
              </>
            )}
          </DsLayoutStack>
        </ContentModal>
      ) : null}
    </DsLayoutStack>
  );
}
