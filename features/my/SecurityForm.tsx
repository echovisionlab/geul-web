'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Divider, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
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
const SECTION_DIVIDER_MARGIN = 'lg';
interface SecurityFormProps {
  subjectId: string;
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
  initialSessions,
  initialProviders,
  initialCanonicalEmail = '',
  initialEmailCodeAvailable = false,
  initialFlowId = null,
  initialLinkProviderParam = null,
  initialUnlinkProviderParam = null,
}: SecurityFormProps) {
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
    setLinkingProvider(provider);
    sessionStorage.removeItem(PENDING_UNLINK_PROVIDER_KEY);
    sessionStorage.setItem(PENDING_LINK_PROVIDER_KEY, provider);
    // The identity settings flow returns here so this page can continue provider linking.
    const returnTo = `/my/security?link_provider=${provider}`;
    window.location.href = `${getPublicAuthUrl()}/self-service/settings/browser?return_to=${encodeURIComponent(returnTo)}&provider=${provider}`;
  };

  const handleUnlinkProvider = (provider: OidcProvider) => {
    const blockedReason = providerUnlinkBlockedReason(provider);
    if (blockedReason) {
      notifications.show({
        title: t('notifications.cannotUnlink'),
        message:
          blockedReason === 'primary_email'
            ? t('providerErrors.primaryEmailRequired')
            : t('providerErrors.mustKeepMethod'),
        color: 'orange',
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
      setRevokingSessionId(sessionId);
      try {
        const result = await revokeMySessionAction(sessionId);
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
          title: t('notifications.success'),
          message: t('notifications.sessionRevoked'),
          color: 'green',
        });
      } catch (error) {
        notifications.show({
          title: tCommonLabels('error'),
          message: error instanceof Error ? error.message : t('notifications.failedToRevokeSession'),
          color: 'red',
        });
      } finally {
        setRevokingSessionId(null);
      }
    },
    [router, subjectId, t, tCommonLabels],
  );

  const handleRevokeOtherSessions = useCallback(async () => {
    setRevokeOthersLoading(true);
    try {
      const result = await revokeMyOtherSessionsAction();
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
        title: t('notifications.success'),
        message: t('notifications.sessionsRevoked'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: tCommonLabels('error'),
        message: error instanceof Error ? error.message : t('notifications.failedToRevokeSessions'),
        color: 'red',
      });
    } finally {
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
      const result = await requestAccountDeletionAction();
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
          color: 'blue',
        });
      } else {
        notifications.show({
          title: tCommonLabels('error'),
          message: result.message || t('notifications.failedToRequestDeletion'),
          color: 'red',
        });
      }
    } catch {
      notifications.show({
        title: tCommonLabels('error'),
        message: t('notifications.failedToRequestDeletion'),
        color: 'red',
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

    const continueOidcLink = async () => {
      setLinkingProvider(provider);

      try {
        const flowRes = await fetch(`${getPublicAuthUrl()}/self-service/settings/flows?id=${flowId}`, {
          credentials: 'include',
        });

        if (!flowRes.ok) {
          throw new Error(t('providerErrors.connectFailed'));
        }

        const flow = (await flowRes.json()) as SettingsFlow;
        const accountExistsMessage = flow.ui?.messages?.find((message) => message.id === ACCOUNT_EXISTS_ERROR_ID);
        const firstError = accountExistsMessage ?? flow.ui?.messages?.find((message) => message.type === 'error');

        if (firstError) {
          notifications.show({
            title: t('notifications.connectionFailed'),
            message: formatLinkErrorMessage(provider, firstError, t, tCommonProviders),
            color: 'red',
          });
          clearFlowState(attemptKey, handledKey, PENDING_LINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        const connectedResult = await getConnectedProvidersAction();
        if (!connectedResult.error && connectedResult.providers.some((connected) => connected.provider === provider)) {
          applySecurityResult(connectedResult);
          notifications.show({
            title: tCommonStates('connected'),
            message: t('notifications.connectedMessage', {
              provider: getProviderName(provider, tCommonProviders),
            }),
            color: 'green',
          });
          clearFlowState(attemptKey, handledKey, PENDING_LINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        if (sessionStorage.getItem(attemptKey) === '1') {
          notifications.show({
            title: t('notifications.connectionFailed'),
            message: t('providerErrors.connectFailed'),
            color: 'red',
          });
          clearFlowState(attemptKey, handledKey, PENDING_LINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        sessionStorage.setItem(attemptKey, '1');
        submitOidcSettingsForm(flowId, provider, 'link', getSettingsFlowCsrfToken(flow));
      } catch {
        notifications.show({
          title: tCommonLabels('error'),
          message: t('providerErrors.connectFailed'),
          color: 'red',
        });
        clearFlowState(attemptKey, handledKey, PENDING_LINK_PROVIDER_KEY);
        router.replace('/my/security');
      } finally {
        setLinkingProvider(null);
      }
    };

    void continueOidcLink();
  }, [applySecurityResult, flowId, pendingLinkProvider, router, t, tCommonLabels, tCommonProviders]);

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

    const continueOidcUnlink = async () => {
      setUnlinkingProvider(provider);

      try {
        const flowRes = await fetch(`${getPublicAuthUrl()}/self-service/settings/flows?id=${flowId}`, {
          credentials: 'include',
        });

        if (!flowRes.ok) {
          throw new Error(
            t('providerErrors.disconnectFailed', {
              provider: getProviderName(provider, tCommonProviders),
            }),
          );
        }

        const flow = (await flowRes.json()) as SettingsFlow;
        const firstError = flow.ui?.messages?.find((message) => message.type === 'error');

        if (firstError) {
          notifications.show({
            title: t('notifications.disconnectionFailed'),
            message: formatUnlinkErrorMessage(provider, firstError, t, tCommonProviders),
            color: 'red',
          });
          clearFlowState(attemptKey, handledKey, PENDING_UNLINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }

        const connectedResult = await getConnectedProvidersAction();
        if (!connectedResult.error) {
          applySecurityResult(connectedResult);
        }

        if (!connectedResult.error && !connectedResult.providers.some((p) => p.provider === provider)) {
          notifications.show({
            title: t('notifications.disconnected'),
            message: t('notifications.disconnectedMessage', {
              provider: getProviderName(provider, tCommonProviders),
            }),
            color: 'green',
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
            color: 'red',
          });
          clearFlowState(attemptKey, handledKey, PENDING_UNLINK_PROVIDER_KEY);
          router.replace('/my/security');
          return;
        }
        sessionStorage.setItem(attemptKey, '1');
        submitOidcSettingsForm(flowId, provider, 'unlink', getSettingsFlowCsrfToken(flow));
      } catch {
        notifications.show({
          title: tCommonLabels('error'),
          message: t('providerErrors.disconnectFailed', {
            provider: getProviderName(provider, tCommonProviders),
          }),
          color: 'red',
        });
        clearFlowState(attemptKey, handledKey, PENDING_UNLINK_PROVIDER_KEY);
        router.replace('/my/security');
      } finally {
        setUnlinkingProvider(null);
      }
    };

    void continueOidcUnlink();
  }, [
    applySecurityResult,
    flowId,
    pendingUnlinkProvider,
    providerUnlinkBlockedReason,
    router,
    t,
    tCommonLabels,
    tCommonProviders,
  ]);

  return (
    <>
      <ConnectedSocialAccountsView
        availableProviders={availableProviders}
        connectedProviders={connectedProviderIds}
        labels={{
          connect: tCommonActions('connect'),
          connected: tCommonStates('connected'),
          description: t('connectedAccounts.description'),
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
        providerIcon={(provider) => (
          <AccountEmailProviderLogo provider={provider} size={provider === 'google' ? 18 : 16} />
        )}
        unlinkBlockedReasons={Object.fromEntries(
          connectedProviderIds.map((provider) => [provider, providerUnlinkBlockedReason(provider)]),
        )}
        unlinkingProvider={unlinkingProvider}
      />

      <Divider my={SECTION_DIVIDER_MARGIN} />

      <PasskeySettingsSection
        subjectId={subjectId}
        hasRecoverableAuthenticationMethod={totalRecoverableCredentials > 0}
      />

      <Divider my={SECTION_DIVIDER_MARGIN} />

      <SessionManagementView
        currentSessionId={currentSessionId}
        labels={{
          activeNow: t('sessions.activeNow'),
          browser: (browser) => (browser === 'unknown' ? tCommonStates('unknown') : t(`sessions.browser.${browser}`)),
          description: t('sessions.description'),
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

      <Divider my={SECTION_DIVIDER_MARGIN} />

      <AccountEmailSettingsView
        email={canonicalEmail}
        emailCodeAvailable={emailCodeAvailable}
        onChangeEmail={() => router.push('/verify')}
        labels={{
          canonical: t('email.canonical'),
          change: t('email.changeAction'),
          description: t('email.description'),
          emailCode: t('email.sources.emailCode'),
          title: t('email.title'),
        }}
      />

      <Divider my={SECTION_DIVIDER_MARGIN} />

      <SectionHeader
        title={
          <Text component="span" c="red">
            {t('dangerZone.title')}
          </Text>
        }
      />

      <Alert tone="danger" mb="md">
        <Text size="sm">{t('dangerZone.alert')}</Text>
      </Alert>

      <Button
        tone="danger"
        emphasis="outline"
        onClick={handleOpenDeleteModal}
        data-testid="security-request-account-deletion"
      >
        {tCommonActions('requestAccountDeletion')}
      </Button>

      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title={tCommonActions('requestAccountDeletion')}
        centered
      >
        <Stack gap="md">
          {deletionRequested ? (
            <>
              <Alert tone="accent">
                <Text size="sm">{t('dangerZone.requestedAlert')}</Text>
              </Alert>
              <Text size="sm" c="dimmed">
                {t('dangerZone.requestedHelper')}
              </Text>
              <Button tone="neutral" emphasis="medium" onClick={closeDeleteModal} fullWidth>
                {tCommonActions('close')}
              </Button>
            </>
          ) : (
            <>
              <Alert tone="warning" icon={<IconAlertTriangle />}>
                <Text size="sm">{t('dangerZone.pendingIntro')}</Text>
                <Text size="sm" component="ul" mt="xs" style={{ paddingLeft: '1.2em' }}>
                  <li>{t('dangerZone.pendingItems.logout')}</li>
                  <li>{t('dangerZone.pendingItems.recover')}</li>
                  <li>{t('dangerZone.pendingItems.anonymous')}</li>
                </Text>
              </Alert>

              <Group justify="flex-end" gap="sm">
                <Button tone="neutral" emphasis="medium" onClick={closeDeleteModal}>
                  {tCommonActions('cancel')}
                </Button>
                <Button tone="danger" onClick={handleRequestAccountDeletion} loading={deleteLoading}>
                  {tCommonActions('sendConfirmationEmail')}
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
