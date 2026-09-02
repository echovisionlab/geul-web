'use client';

import Link from 'next/link';
import { IconKey, IconMail } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Anchor, Divider, Stack, Text, Title } from '@mantine/core';
import { TextInput } from '@/components/core/Input';
import { SectionCard } from '@/components/core/Section';
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

  return (
    <SectionCard p="xl" maw={420} w="100%">
      <Stack gap="lg">
        <Title order={2} ta="center">
          {accountLinking ? t('accountLinking.title') : t('title')}
        </Title>

        {securityReauthentication && !accountLinking ? (
          <Text size="sm" c="dimmed" ta="center" data-testid="security-reauthentication-message">
            {t('securityReauthentication.description')}
          </Text>
        ) : null}

        {newsletterIntent && !accountLinking ? (
          <Text size="sm" c="dimmed" ta="center">
            {t('newsletterIntent.description')}
          </Text>
        ) : null}

        {accountLinking ? (
          <Stack gap={4} ta="center">
            <Text size="sm" c="dimmed">
              {t('accountLinking.description')}
            </Text>
            {accountLinking.identifier ? (
              <Text size="sm" fw={600}>
                {accountLinking.identifier}
              </Text>
            ) : null}
          </Stack>
        ) : null}

        {visibleError ? (
          <Text size="sm" c="red" role="alert">
            {visibleError}
          </Text>
        ) : null}

        {awaitingCode ? (
          <Stack gap="md">
            <Stack gap={4}>
              <Text fw={600}>{t('code.title')}</Text>
              <Text size="sm" c="dimmed">
                {t('code.description')}
              </Text>
            </Stack>
            <AuthCodeChallengeView
              code={code}
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
          </Stack>
        ) : (
          <Stack gap="lg">
            {providers.length > 0 ? (
              <Stack gap="sm">
                <SocialAuthButtons
                  disabled={authActionPending}
                  flow={flow}
                  fallbackActionUrl={actionUrl}
                  label={(provider) => t('continueWith', { provider: tCommonProviders(provider) })}
                  onSubmit={onSocialSubmit}
                  submittingProvider={socialSubmittingProvider}
                />
              </Stack>
            ) : null}

            {supportsCode ? (
              <>
                {providers.length > 0 ? <Divider label={t('divider')} labelPosition="center" /> : null}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!accountLinking && !email.trim()) {
                      return;
                    }
                    onRequestCode();
                  }}
                >
                  <Stack gap="sm">
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
                      />
                    ) : null}
                    <AuthActionButton
                      id="login-email-code-submit"
                      type="submit"
                      loading={emailSubmitting}
                      disabled={authActionPending && !emailSubmitting}
                      leftSection={<IconMail size={18} />}
                    >
                      {accountLinking ? t('accountLinking.confirmWithEmail') : t('emailCode')}
                    </AuthActionButton>
                  </Stack>
                </form>
              </>
            ) : null}

            {supportsPasskey ? (
              <>
                {supportsCode || providers.length > 0 ? <Divider label={t('divider')} labelPosition="center" /> : null}
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
                    leftSection={<IconKey size={18} />}
                    onClick={onPasskeyLogin}
                    disabled={!passkeyReady || (authActionPending && !passkeySubmitting)}
                    loading={passkeyLoading || passkeySubmitting}
                    aria-busy={passkeyLoading || passkeySubmitting}
                    data-testid="login-passkey"
                  >
                    {t('passkey')}
                  </AuthActionButton>
                </form>
              </>
            ) : null}
          </Stack>
        )}

        <Divider />

        <Text size="xs" c="dimmed" ta="center">
          {t.rich('legalNotice', {
            terms: (chunks) => (
              <Anchor component={Link} href="/terms" size="xs" underline="hover">
                {chunks}
              </Anchor>
            ),
            privacy: (chunks) => (
              <Anchor component={Link} href="/privacy" size="xs" underline="hover">
                {chunks}
              </Anchor>
            ),
          })}
        </Text>
      </Stack>
    </SectionCard>
  );
}
