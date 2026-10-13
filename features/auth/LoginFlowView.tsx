'use client';

import { useEffect, useId, useRef } from 'react';

import { LayoutContainer as DsLayoutContainer, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { IconKey, IconMail } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Separator as Divider } from '@/components/core/Display';
import { NavigationLink as Anchor } from '@/components/core/Navigation';
import { TextInput } from '@/components/core/Input';
import type { AuthProvider } from '@/features/auth/providers';
import { AuthCodeChallengeView, type AuthCodeTimingViewModel } from './ui/AuthCodeChallengeView';
import { AuthActionButton } from './ui/AuthActionButton';
import {
  findKratosNode,
  getKratosCsrfToken,
  getKratosFlowErrors,
  getKratosNodeStringValue,
  getSecureAccountLinkingContext,
  hasKratosNode,
  type KratosBrowserFlow,
} from './kratos-flow';
import { getAvailableAuthProviders, SocialAuthButtons } from './SocialAuthButtons';

export type LoginPendingAction = 'email' | 'passkey' | AuthProvider;

interface LoginFlowViewProps {
  flow: KratosBrowserFlow;
  actionUrl: string;
  newsletterIntent: boolean;
  securityReauthentication: boolean;
  email: string;
  code: string;
  codeTiming: AuthCodeTimingViewModel | null;
  passkeyLoading: boolean;
  passkeyReady: boolean;
  pendingAction: LoginPendingAction | null;
  submitError: string | null;
  onEmailChange: (email: string) => void;
  onCodeChange: (code: string) => void;
  onRequestCode: () => void;
  onSubmitCode: (completedCode?: string) => void;
  onResendCode: () => void;
  onPasskeyLogin: () => void;
  onSocialSubmit: (provider: AuthProvider) => void;
  onStartOver: () => void;
}

export function LoginFlowView({
  flow,
  actionUrl,
  newsletterIntent,
  securityReauthentication,
  email,
  code,
  codeTiming,
  passkeyLoading,
  passkeyReady,
  pendingAction,
  submitError,
  onEmailChange,
  onCodeChange,
  onRequestCode,
  onSubmitCode,
  onResendCode,
  onPasskeyLogin,
  onSocialSubmit,
  onStartOver,
}: LoginFlowViewProps) {
  const t = useTranslations('auth.login');
  const tAuthCommon = useTranslations('auth.common');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonProviders = useTranslations('common.providers');
  const csrfToken = getKratosCsrfToken(flow);
  const accountLinking = getSecureAccountLinkingContext(flow);
  const awaitingCode = hasKratosNode(flow, 'code');
  const supportsPasskey =
    hasKratosNode(flow, 'passkey_login_trigger') &&
    hasKratosNode(flow, 'passkey_challenge') &&
    hasKratosNode(flow, 'passkey_login');
  const supportsCode = flow.ui.nodes.some((node) => node.group === 'code' && node.attributes.name === 'method');
  const identifierFromFlow = getKratosNodeStringValue(flow, 'identifier');
  const flowErrors = getKratosFlowErrors(flow);
  const visibleFlowError = flowErrors.length === 0 ? null : awaitingCode ? t('code.invalid') : t('errors.loginFailed');
  const visibleError = submitError ?? visibleFlowError;
  const providers = getAvailableAuthProviders(flow);
  const emailSubmitting = pendingAction === 'email';
  const passkeySubmitting = pendingAction === 'passkey';
  const socialSubmittingProvider = providers.find((provider) => provider === pendingAction) ?? null;
  const authActionPending = pendingAction !== null;
  const titleId = useId();
  const errorId = useId();
  const codeDescriptionId = useId();
  const viewRef = useRef<HTMLElement>(null);
  const previousChallenge = useRef(awaitingCode);
  const previousError = useRef(visibleError);
  useEffect(() => {
    if (previousChallenge.current !== awaitingCode) {
      previousChallenge.current = awaitingCode;
      viewRef.current?.querySelector<HTMLInputElement>('input:not([type="hidden"]):not(:disabled)')?.focus();
    }
  }, [awaitingCode]);
  useEffect(() => {
    if (authActionPending) {
      return;
    }
    const newError = visibleError && previousError.current !== visibleError;
    previousError.current = visibleError;
    if (newError && !viewRef.current?.contains(document.activeElement)) {
      viewRef.current?.querySelector<HTMLInputElement>('input:not([type="hidden"]):not(:disabled)')?.focus();
    }
  }, [authActionPending, visibleError]);

  return (
    <DsLayoutContainer ref={viewRef} size="form" inset="none" role="group" aria-labelledby={titleId}>
      <DsLayoutStack gap="lg">
        <DsHeading id={titleId} level={1} scale={2} align="center">
          {accountLinking ? t('accountLinking.title') : t('title')}
        </DsHeading>

        {securityReauthentication && !accountLinking ? (
          <DsText size="sm" tone="secondary" align="center" data-testid="security-reauthentication-message">
            {t('securityReauthentication.description')}
          </DsText>
        ) : null}

        {newsletterIntent && !accountLinking ? (
          <DsText size="sm" tone="secondary" align="center">
            {t('newsletterIntent.description')}
          </DsText>
        ) : null}

        {accountLinking ? (
          <DsLayoutStack gap="xxs" align="center">
            <DsText size="sm" tone="secondary">
              {t('accountLinking.description')}
            </DsText>
            {accountLinking.identifier ? (
              <DsText size="sm" weight="strong">
                {accountLinking.identifier}
              </DsText>
            ) : null}
          </DsLayoutStack>
        ) : null}

        {visibleError ? (
          <DsText id={errorId} size="sm" tone="danger" role="alert">
            {visibleError}
          </DsText>
        ) : null}

        {awaitingCode ? (
          <DsLayoutStack gap="md">
            <DsLayoutStack gap="xxs">
              <DsText size="sm" weight="strong">
                {t('code.title')}
              </DsText>
              <DsText id={codeDescriptionId} size="sm" tone="secondary">
                {t('code.description')}
              </DsText>
            </DsLayoutStack>
            <AuthCodeChallengeView
              code={code}
              aria-invalid={Boolean(visibleError)}
              aria-describedby={[codeDescriptionId, visibleError ? errorId : null].filter(Boolean).join(' ')}
              labels={{
                codeAriaLabel: t('code.label'),
                codeExpired: tAuthCommon('codeTiming.expired'),
                codeExpiresIn: (time) => tAuthCommon('codeTiming.expiresIn', { time }),
                flowExpired: t('errors.flowExpired'),
                resend: t('code.resend'),
                resendIn: (time) => tAuthCommon('codeTiming.resendIn', { time }),
                startOver: t('code.differentEmail'),
                submit: t('code.submit'),
              }}
              onCodeChange={onCodeChange}
              onResend={onResendCode}
              onStartOver={onStartOver}
              onSubmit={(completedCode) => onSubmitCode(completedCode)}
              submitting={emailSubmitting}
              timing={codeTiming}
            />
          </DsLayoutStack>
        ) : (
          <DsLayoutStack gap="lg">
            {supportsCode ? (
              <>
                <form
                  aria-labelledby={titleId}
                  aria-busy={emailSubmitting}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!accountLinking && !email.trim()) {
                      return;
                    }
                    onRequestCode();
                  }}
                >
                  <DsLayoutStack gap="sm">
                    {!accountLinking ? (
                      <TextInput
                        id="login-email-input"
                        name="identifier"
                        label={tCommonLabels('email')}
                        type="email"
                        autoComplete={
                          findKratosNode(flow, 'identifier')?.attributes.autocomplete ?? 'username webauthn'
                        }
                        placeholder={tCommonPlaceholders('emailExample')}
                        value={email}
                        onChange={(event) => onEmailChange(event.currentTarget.value)}
                        required
                        aria-invalid={Boolean(visibleError)}
                        aria-describedby={visibleError ? errorId : undefined}
                      />
                    ) : null}
                    <AuthActionButton
                      id="login-email-code-submit"
                      type="submit"
                      emphasis={accountLinking ? 'medium' : 'strong'}
                      loading={emailSubmitting}
                      disabled={authActionPending && !emailSubmitting}
                      leftSection={<IconMail size="1em" aria-hidden />}
                    >
                      {accountLinking ? t('accountLinking.confirmWithEmail') : t('emailCode')}
                    </AuthActionButton>
                  </DsLayoutStack>
                </form>
              </>
            ) : null}

            {supportsCode && (supportsPasskey || providers.length > 0) ? (
              <Divider label={t('divider')} labelPosition="center" />
            ) : null}

            {supportsPasskey || providers.length > 0 ? (
              <DsLayoutStack gap="sm">
                {supportsPasskey ? (
                  <form action={actionUrl} method="POST">
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <input type="hidden" name="identifier" value={identifierFromFlow || email} />
                    <input
                      type="hidden"
                      name="passkey_challenge"
                      value={getKratosNodeStringValue(flow, 'passkey_challenge')}
                    />
                    <input type="hidden" name="passkey_login" value="" />
                    <AuthActionButton
                      type="button"
                      emphasis="medium"
                      leftSection={<IconKey size="1em" aria-hidden />}
                      onClick={onPasskeyLogin}
                      disabled={!passkeyReady || (authActionPending && !passkeySubmitting)}
                      loading={passkeyLoading || passkeySubmitting}
                      aria-busy={passkeyLoading || passkeySubmitting}
                      data-testid="login-passkey"
                    >
                      {t('passkey')}
                    </AuthActionButton>
                  </form>
                ) : null}
                {providers.length > 0 ? (
                  <SocialAuthButtons
                    disabled={authActionPending}
                    flow={flow}
                    fallbackActionUrl={actionUrl}
                    label={(provider) => t('continueWith', { provider: tCommonProviders(provider) })}
                    onSubmit={onSocialSubmit}
                    submittingProvider={socialSubmittingProvider}
                  />
                ) : null}
              </DsLayoutStack>
            ) : null}
          </DsLayoutStack>
        )}

        <DsText size="xs" tone="secondary" align="center">
          {t.rich('legalNotice', {
            terms: (chunks) => (
              <Anchor href="/terms" size="xs" appearance="content">
                {chunks}
              </Anchor>
            ),
            privacy: (chunks) => (
              <Anchor href="/privacy" size="xs" appearance="content">
                {chunks}
              </Anchor>
            ),
          })}
        </DsText>
      </DsLayoutStack>
    </DsLayoutContainer>
  );
}
