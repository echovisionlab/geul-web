import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { PageLoader } from '@/features/site/PageLoader';
import { LoginFlowView } from '@/features/auth/LoginFlowView';
import type { KratosBrowserFlow } from '@/features/auth/kratos-flow';

type LoginState = 'email' | 'code' | 'expired' | 'error' | 'pending' | 'refresh' | 'refresh-error' | 'code-pending';
function LoginPagePreview({ initialState = 'email' }: { initialState?: LoginState }) {
  const t = useTranslations();
  const [step, setStep] = useState<LoginState>(initialState);
  const [email, setEmail] = useState('june@example.com');
  const [code, setCode] = useState(initialState === 'code-pending' ? '123456' : '');
  const [complete, setComplete] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const awaitingCode = step === 'code' || step === 'expired' || step === 'code-pending';
  const securityReauthentication = step === 'refresh' || step === 'refresh-error';
  const flow: KratosBrowserFlow = {
    id: 'preview-only-login',
    ui: {
      nodes: [
        { type: 'input', group: 'code', attributes: { name: 'method', value: 'code' } },
        { type: 'input', group: 'code', attributes: { name: 'identifier', value: email } },
        ...(awaitingCode ? [{ type: 'input', group: 'code', attributes: { name: 'code', value: '' } }] : []),
      ],
    },
  };
  return (
    <LayoutContainer size="compact" inset="md">
      <LayoutStack gap="md" align="center">
        {complete ? (
          <Alert tone="positive" role="status">
            {t('auth.login.code.title')}
          </Alert>
        ) : null}
        <LoginFlowView
          flow={flow}
          actionUrl="#preview-only"
          newsletterIntent={false}
          securityReauthentication={securityReauthentication}
          email={email}
          code={code}
          codeTiming={
            awaitingCode
              ? { expiresInSeconds: step === 'expired' ? 0 : 300, flowExpiresInSeconds: 600, resendInSeconds: 0 }
              : null
          }
          passkeyLoading={false}
          passkeyReady={false}
          pendingAction={step === 'pending' || step === 'code-pending' ? 'email' : null}
          loadingSurface={<PageLoader placement="flow" message={t('auth.verification.sentEmail.submitting')} />}
          submitError={
            step === 'refresh-error'
              ? t('auth.login.errors.loginFailed')
              : invalid || step === 'error'
                ? t('auth.login.code.invalid')
                : null
          }
          onEmailChange={setEmail}
          onCodeChange={setCode}
          onRequestCode={() => {
            setStep(securityReauthentication ? 'refresh-error' : 'code');
            setInvalid(false);
          }}
          onSubmitCode={(completedCode) => {
            const accepted = (completedCode ?? code) === '123456';
            setInvalid(!accepted);
            setComplete(accepted);
          }}
          onResendCode={() => {
            setStep('code');
            setCode('');
            setInvalid(false);
          }}
          onStartOver={() => {
            setStep('email');
            setCode('');
            setInvalid(false);
            setComplete(false);
          }}
          onPasskeyLogin={() => undefined}
          onSocialSubmit={() => undefined}
        />
      </LayoutStack>
    </LayoutContainer>
  );
}
const meta = {
  title: 'Pages/Auth/Login',
  component: LoginPagePreview,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual /login LoginFlowView. Local email/code callbacks; code 123456 accepts locally. Refresh submission fails locally and replaces the reauthentication intro with an error. No identity/session creation, delivery, provider or passkey integration. Toolbar locale/theme apply to the production view.',
      },
    },
  },
  args: { initialState: 'email' },
  render: (args) => <LoginPagePreview key={args.initialState} {...args} />,
} satisfies Meta<typeof LoginPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Email: Story = {};
export const Code: Story = { args: { initialState: 'code' } };
export const Expired: Story = { args: { initialState: 'expired' } };
export const Error: Story = { args: { initialState: 'error' } };
export const SubmittingCode: Story = { args: { initialState: 'code-pending' } };
export const Pending: Story = { args: { initialState: 'pending' } };
export const Refresh: Story = { args: { initialState: 'refresh' } };
export const RefreshError: Story = { args: { initialState: 'refresh-error' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
