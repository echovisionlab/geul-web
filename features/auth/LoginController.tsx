'use client';

import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { AuthProvider } from '@/features/auth/providers';
import { PageLoader } from '@/features/site/PageLoader';
import { setCurrentUserNewsletterSubscriptionAction } from '@/lib/actions/newsletter';
import { shouldRedirectAuthenticatedLogin } from './login-flow-guards';
import {
  findKratosNode,
  getKratosCsrfToken,
  getKratosFlowErrors,
  getKratosNodeStringValue,
  getKratosScriptNodes,
  invokeKratosBrowserCeremony,
  invokeKratosBrowserTrigger,
  isKratosWebAuthnRuntimeReady,
  type KratosBrowserFlow,
} from './kratos-flow';
import { KratosWebAuthnScript } from './KratosWebAuthnScript';
import { buildLoginCodePayload } from './login-code';
import { LoginFlowView, type LoginPendingAction } from './LoginFlowView';
import { LoginStatusView } from './ui/LoginStatusView';
import { isSecurityReauthenticationReturnTarget } from './security-reauthentication';
import {
  buildNewsletterAuthContinuation,
  claimNewsletterAuthContinuation,
  clearNewsletterAuthContinuation,
  rememberNewsletterAuthContinuation,
  resolveLoginSuccessRedirect,
  resolveNewsletterAuthContinuation,
} from './login-redirect';
import type { UnifiedLoginTransport } from './unified-login-transport';
import { useAuthCodeTiming } from './use-auth-code-timing';
import { useLoginContinuation, type LoginNavigation } from './use-login-continuation';

interface LoginErrorLabels {
  generic: string;
  accountBanned: string;
  flowExpired: string;
}

function formatLocalizedLoginErrorMessage(error: unknown, labels: LoginErrorLabels): string {
  const text = error instanceof Error ? error.message.trim() : '';
  if (/account.*(banned|suspended|deactivated)/i.test(text) || /(banned|suspended|deactivated).*account/i.test(text)) {
    return labels.accountBanned;
  }
  if (
    /flow not found or expired/i.test(text) ||
    /login flow.*expired/i.test(text) ||
    /request (has )?expired/i.test(text)
  ) {
    return labels.flowExpired;
  }
  return labels.generic;
}

interface LoginControllerProps {
  applyNewsletterSubscription?: () => Promise<{ success: boolean }>;
  errorParam?: string | null;
  flowId?: string | null;
  hasSession: boolean;
  initialEmail?: string;
  isSessionPending: boolean;
  newsletterIntent?: boolean;
  navigation: LoginNavigation;
  redirectUrl?: string;
  transport: UnifiedLoginTransport;
}

function applyCurrentUserNewsletterSubscription() {
  return setCurrentUserNewsletterSubscriptionAction(true);
}

function payloadReturnTo(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const value = (payload as { return_to?: unknown }).return_to;
  return typeof value === 'string' ? value : undefined;
}

function isPasskeyCancellation(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError');
}

export function LoginController({
  applyNewsletterSubscription = applyCurrentUserNewsletterSubscription,
  errorParam = null,
  flowId = null,
  hasSession,
  initialEmail = '',
  isSessionPending,
  newsletterIntent = false,
  navigation,
  redirectUrl = '/',
  transport,
}: LoginControllerProps) {
  const locale = useLocale();
  const requestScope = `${flowId ?? ''}:${locale}`;
  const currentScope = useRef(requestScope);
  currentScope.current = requestScope;
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  const t = useTranslations('auth.login');
  const tVerification = useTranslations('auth.verification');
  const tCommonActions = useTranslations('common.actions');
  const tNewsletter = useTranslations('settings.newsletter');
  const [flow, setFlow] = useState<KratosBrowserFlow | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowErrorScope, setFlowErrorScope] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [passkeyStatus, setPasskeyStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [pendingAction, setPendingAction] = useState<LoginPendingAction | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isRefreshFlow = flow?.refresh === true;
  const {
    applyNewsletterIntent,
    browserUrl,
    consumeStoredRedirect,
    handlesNewsletterIntent,
    newsletterContinuation,
    newsletterIntentStatus,
    redirectAfterSuccess,
  } = useLoginContinuation({
    applyNewsletterSubscription,
    flowId,
    flowReturnTo: flow?.return_to,
    hasSession,
    isSessionPending,
    navigation,
    newsletterIntent,
    redirectUrl,
    transport,
  });
  const awaitingCode = Boolean(flow && findKratosNode(flow, 'code'));
  const {
    clearAcceptedDelivery,
    recordAcceptedDelivery,
    timing: codeTiming,
  } = useAuthCodeTiming({
    active: awaitingCode,
    flowExpiresAt: flow?.expires_at,
    flowId: flow?.id ?? flowId ?? 'pending',
    purpose: 'login',
  });

  const acceptFlow = useCallback(
    (nextFlow: KratosBrowserFlow) => {
      const nextNewsletterContinuation = resolveNewsletterAuthContinuation(nextFlow.return_to, navigation.origin);
      if (nextNewsletterContinuation) {
        rememberNewsletterAuthContinuation(
          buildNewsletterAuthContinuation(nextNewsletterContinuation.redirectUrl, navigation.origin),
          navigation.origin,
          nextFlow.id,
        );
      } else {
        clearNewsletterAuthContinuation();
      }
      const nextPasskeyTrigger = findKratosNode(nextFlow, 'passkey_login_trigger')?.attributes.onclickTrigger;
      setPasskeyStatus(nextPasskeyTrigger && getKratosScriptNodes(nextFlow).length > 0 ? 'loading' : 'unavailable');
      setPendingAction(null);
      setFlow(nextFlow);
      setSubmitError(null);
    },
    [navigation.origin],
  );

  useEffect(() => {
    if (errorParam) {
      clearNewsletterAuthContinuation();
    }
  }, [errorParam]);

  useEffect(() => {
    if (handlesNewsletterIntent) {
      return;
    }
    const shouldRedirect = shouldRedirectAuthenticatedLogin({
      hasSession,
      isPending: isSessionPending,
      flowId,
      flowLoading,
      hasFlow: Boolean(flow),
      hasFlowError: Boolean(flowError),
      isRefreshFlow,
    });
    if (!shouldRedirect) {
      return;
    }

    clearNewsletterAuthContinuation();
    const finalRedirect = resolveLoginSuccessRedirect({
      storedRedirect: consumeStoredRedirect(),
      flowReturnTo: flow?.return_to,
      redirectUrl,
      origin: navigation.origin,
    });
    if (/^https?:\/\//i.test(finalRedirect)) {
      navigation.assign(finalRedirect);
    } else {
      navigation.replace(finalRedirect);
    }
  }, [
    consumeStoredRedirect,
    flow,
    flowError,
    flowId,
    flowLoading,
    hasSession,
    handlesNewsletterIntent,
    isRefreshFlow,
    isSessionPending,
    navigation,
    redirectUrl,
  ]);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    if (!flowId || isSessionPending || errorParam) {
      return;
    }

    const active = () => mounted.current && generation.current === requestGeneration;
    setFlowLoading(true);
    setFlow(null);
    setFlowError(null);
    setFlowErrorScope(requestScope);
    setSubmitError(null);
    setPendingAction(null);
    const pendingNewsletterContinuation = claimNewsletterAuthContinuation(flowId, navigation.origin);
    const restartUrl = browserUrl(
      pendingNewsletterContinuation
        ? buildNewsletterAuthContinuation(pendingNewsletterContinuation.redirectUrl, navigation.origin)
        : undefined,
    );
    void transport
      .load(flowId, restartUrl)
      .then((outcome) => {
        if (!active()) {
          return;
        }
        switch (outcome.kind) {
          case 'continued':
            setLoadedScope(requestScope);
            acceptFlow(outcome.flow);
            setFlowError(null);
            break;
          case 'restart':
            if (pendingNewsletterContinuation) {
              rememberNewsletterAuthContinuation(
                buildNewsletterAuthContinuation(pendingNewsletterContinuation.redirectUrl, navigation.origin),
                navigation.origin,
              );
            } else {
              clearNewsletterAuthContinuation();
            }
            navigation.assign(outcome.url);
            break;
          case 'rate-limited':
            setFlowError(t('errors.rateLimited', { seconds: outcome.retryAfterSeconds }));
            break;
          default:
            clearNewsletterAuthContinuation();
            setFlowError(t('errors.flowExpired'));
        }
      })
      .catch((error: unknown) => {
        if (active()) {
          clearNewsletterAuthContinuation();
          setFlowError(
            formatLocalizedLoginErrorMessage(error, {
              generic: t('errors.generic'),
              accountBanned: t('errors.accountBanned'),
              flowExpired: t('errors.flowExpired'),
            }),
          );
        }
      })
      .finally(() => {
        if (active()) {
          setFlowLoading(false);
        }
      });

    return () => {
      generation.current += 1;
    };
  }, [acceptFlow, browserUrl, errorParam, flowId, isSessionPending, navigation, requestScope, t, transport]);

  useEffect(() => {
    if (!isSessionPending && !hasSession && !flowId && !errorParam) {
      navigation.assign(browserUrl(undefined, true));
    }
  }, [browserUrl, errorParam, flowId, hasSession, isSessionPending, navigation]);

  const submitLogin = async (payload: Record<string, unknown>) => {
    if (
      !flow ||
      flowLoading ||
      loadedScope !== requestScope ||
      isSessionPending ||
      errorParam ||
      pendingAction !== null
    ) {
      return;
    }

    const requestGeneration = ++generation.current;
    const scope = requestScope;
    const action = awaitingCode && typeof payload.code !== 'string' ? 'resend' : 'email';
    const active = () => mounted.current && generation.current === requestGeneration && currentScope.current === scope;
    setPendingAction(action);
    setSubmitError(null);
    try {
      const codeDeliveryRequest = payload.method === 'code' && typeof payload.code !== 'string';
      const outcome = await transport.submit(
        flow.id,
        {
          ...payload,
          csrf_token: getKratosCsrfToken(flow),
        },
        browserUrl(flow.return_to),
      );
      if (!active()) {
        return;
      }
      switch (outcome.kind) {
        case 'continued': {
          const nextFlow = outcome.flow;
          const stillAwaitingCode = Boolean(findKratosNode(nextFlow, 'code'));
          const flowErrors = getKratosFlowErrors(nextFlow);
          if (outcome.ok && !stillAwaitingCode) {
            await redirectAfterSuccess(nextFlow);
            return;
          }
          acceptFlow(nextFlow);
          if (codeDeliveryRequest && stillAwaitingCode && flowErrors.length === 0) {
            recordAcceptedDelivery(nextFlow.id);
            setCode('');
          }
          break;
        }
        case 'completed':
          await redirectAfterSuccess({ ...flow, return_to: payloadReturnTo(outcome.payload) ?? flow.return_to });
          break;
        case 'restart':
          if (newsletterContinuation) {
            rememberNewsletterAuthContinuation(
              buildNewsletterAuthContinuation(newsletterContinuation.redirectUrl, navigation.origin),
              navigation.origin,
            );
          } else {
            clearNewsletterAuthContinuation();
          }
          navigation.assign(outcome.url);
          break;
        case 'rate-limited':
          setSubmitError(t('errors.rateLimited', { seconds: outcome.retryAfterSeconds }));
          break;
        case 'failed':
          setSubmitError(t('errors.loginFailed'));
          break;
      }
    } catch {
      if (active()) {
        setSubmitError(t('errors.loginFailed'));
      }
    } finally {
      if (active()) {
        setPendingAction((current) => (current === action ? null : current));
      }
    }
  };

  const startOver = () => {
    generation.current += 1;
    clearAcceptedDelivery();
    navigation.assign(browserUrl(flow?.return_to, true));
  };

  if (errorParam) {
    const errorMessages: Record<string, string> = {
      oauth_failed: t('errors.oauthFailed'),
      missing_params: t('errors.missingParams'),
      invalid_state: t('errors.invalidState'),
      token_exchange_failed: t('errors.tokenExchangeFailed'),
      no_id_token: t('errors.noIdToken'),
      invalid_token: t('errors.invalidToken'),
      account_banned: t('errors.accountBanned'),
      internal_error: t('errors.internalError'),
    };
    return (
      <LoginStatusView
        kind="error"
        message={errorMessages[errorParam] || t('errors.generic')}
        retryHref={browserUrl()}
        retryLabel={tCommonActions('tryAgain')}
      />
    );
  }

  if (flowError && flowErrorScope === requestScope) {
    return (
      <LoginStatusView
        kind="error"
        message={flowError}
        retryHref={browserUrl()}
        retryLabel={tCommonActions('tryAgain')}
      />
    );
  }

  if (newsletterIntentStatus === 'applying') {
    return <PageLoader message={t('newsletterIntent.applying')} />;
  }

  if (newsletterIntentStatus === 'ready') {
    return (
      <LoginStatusView
        kind="newsletter-ready"
        message={t('newsletterIntent.confirm')}
        actionLabel={tNewsletter('subscribe')}
        onAction={() => void applyNewsletterIntent()}
      />
    );
  }

  if (newsletterIntentStatus === 'failed') {
    return (
      <LoginStatusView
        kind="newsletter-failed"
        message={t('newsletterIntent.failed')}
        retryLabel={tCommonActions('tryAgain')}
        onRetry={() => void applyNewsletterIntent()}
      />
    );
  }

  if (newsletterIntentStatus === 'complete') {
    return <PageLoader message={t('redirecting')} />;
  }

  if (!flow || flowLoading || loadedScope !== requestScope) {
    return <PageLoader message={flowLoading ? t('loading') : t('redirecting')} />;
  }

  const passkeyTrigger = findKratosNode(flow, 'passkey_login_trigger')?.attributes.onclickTrigger;
  const passkeyOnLoadTrigger = findKratosNode(flow, 'passkey_login')?.attributes.onloadTrigger;
  const passkeyScripts = getKratosScriptNodes(flow);
  const supportsPasskeyRuntime = Boolean(passkeyTrigger && passkeyScripts.length > 0);
  const startPasskeyLogin = async () => {
    if (pendingAction !== null) {
      return;
    }
    if (!isKratosWebAuthnRuntimeReady('get', [passkeyTrigger])) {
      setPasskeyStatus('unavailable');
      setSubmitError(t('passkeyUnavailable'));
      return;
    }

    const requestGeneration = ++generation.current;
    const scope = requestScope;
    const active = () => mounted.current && generation.current === requestGeneration && currentScope.current === scope;
    setPendingAction('passkey');
    setSubmitError(null);
    try {
      const submitted = await invokeKratosBrowserCeremony(passkeyTrigger, {
        operation: 'get',
        resultFieldName: 'passkey_login',
        cancelAfterWindowRefocusMs: 1000,
      });
      if (!active()) {
        return;
      }
      if (!submitted) {
        setPasskeyStatus('unavailable');
        setSubmitError(t('passkeyUnavailable'));
      }
    } catch (error: unknown) {
      if (active() && !isPasskeyCancellation(error)) {
        setPasskeyStatus('unavailable');
        setSubmitError(t('passkeyUnavailable'));
      }
    } finally {
      if (active()) {
        setPendingAction((current) => (current === 'passkey' ? null : current));
      }
    }
  };
  const startSocialLogin = (provider: AuthProvider) => {
    if (pendingAction === null) {
      generation.current += 1;
      setPendingAction(provider);
    }
  };

  return (
    <DsLayoutInset space="md">
      <DsLayoutStack align="center" justify="center" flexible>
        {supportsPasskeyRuntime ? (
          <KratosWebAuthnScript
            nodes={passkeyScripts}
            readyKey={`${flow.id}:${String(passkeyOnLoadTrigger ?? '')}`}
            credentialOperation="get"
            requiredTriggers={[passkeyTrigger]}
            onReady={() => {
              setPasskeyStatus('ready');
              invokeKratosBrowserTrigger(passkeyOnLoadTrigger);
            }}
            onError={() => {
              setPasskeyStatus('unavailable');
              setSubmitError(t('passkeyUnavailable'));
            }}
          />
        ) : null}
        <LoginFlowView
          flow={flow}
          actionUrl={transport.actionUrl(flow.id)}
          newsletterIntent={handlesNewsletterIntent}
          securityReauthentication={isRefreshFlow && isSecurityReauthenticationReturnTarget(flow.return_to)}
          email={email}
          code={code}
          codeTiming={codeTiming}
          passkeyLoading={passkeyStatus === 'loading'}
          passkeyReady={passkeyStatus === 'ready'}
          pendingAction={pendingAction}
          submitError={submitError}
          loadingSurface={
            <PageLoader placement="flow" extent="compact" size="sm" message={tVerification('sentEmail.submitting')} />
          }
          onEmailChange={setEmail}
          onCodeChange={setCode}
          onRequestCode={() => void submitLogin(buildLoginCodePayload({ flow, enteredEmail: email, locale }))}
          onSubmitCode={(completedCode = code) =>
            void submitLogin(
              buildLoginCodePayload({
                flow,
                enteredEmail: email,
                code: completedCode,
                locale,
              }),
            )
          }
          onResendCode={() =>
            void submitLogin(
              buildLoginCodePayload({
                flow,
                enteredEmail: email || getKratosNodeStringValue(flow, 'identifier'),
                resend: getKratosNodeStringValue(flow, 'resend') || 'code',
                locale,
              }),
            )
          }
          onPasskeyLogin={() => void startPasskeyLogin()}
          onSocialSubmit={startSocialLogin}
          onStartOver={startOver}
        />
      </DsLayoutStack>
    </DsLayoutInset>
  );
}
