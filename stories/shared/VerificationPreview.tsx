import { localizeFixtureTree, useStorybookText } from '../../.storybook/fixture-i18n';
import { useState } from 'react';
import { Alert } from '@/components/core/Alert';
import {
  VerificationFlowView,
  type VerificationViewState,
  type VerificationFlowLabels,
} from '@/features/auth/ui/VerificationFlowView';
import { PreviewFrame, type PreviewState } from './PreviewFrame';

const labels: VerificationFlowLabels = {
  back: 'Back',
  chooseDescription: 'Choose the email address to verify.',
  chooseSubmit: 'Send verification code',
  chooseTitle: 'Verify email',
  code: {
    codeAriaLabel: 'Verification code',
    codeExpired: 'This code has expired.',
    codeExpiresIn: (time) => `Code expires in ${time}`,
    flowExpired: 'This session has expired.',
    resend: 'Send a new code',
    resendIn: (time) => `Resend in ${time}`,
    startOver: 'Start over',
    submit: 'Verify code',
  },
  emailLabel: 'Email',
  emailPlaceholder: 'name@example.com',
  passedAction: 'Continue',
  passedDescription: 'The preview email is verified.',
  passedTitle: 'Email verified',
  applyingDescription: 'The code was accepted. Check again to complete this local flow.',
  applyingRetry: 'Check again',
  applyingTitle: 'Applying verification',
  sentDescription: 'Enter the preview code 123456.',
  sentTitle: 'Check your email',
  submittingCode: 'Verifying code…',
};

export function VerificationPreview({
  state = 'ready',
  initialStep = 'choose_email',
}: {
  state?: PreviewState;
  initialStep?: VerificationViewState;
}) {
  const fixtureText = useStorybookText();
  const [step, setStep] = useState<VerificationViewState>(initialStep);
  const [email, setEmail] = useState('june@example.com');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const startOver = () => {
    setStep('choose_email');
    setCode('');
    setError(null);
    setNotice('');
  };
  return localizeFixtureTree(
    <PreviewFrame
      title="Pages · email verification"
      description="The /verify production view with local callbacks. Send a code, enter 123456, check application, and continue. Other codes expose validation; no email is sent."
    >
      {notice ? (
        <Alert role="status" tone="positive">
          {notice}
        </Alert>
      ) : null}
      <fieldset disabled={state === 'disabled'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <VerificationFlowView
          code={code}
          email={email}
          state={step}
          labels={{
            ...labels,
            code: {
              ...labels.code,
              codeExpiresIn: (time) => fixtureText('Code expires in {time}', { time }),
              resendIn: (time) => fixtureText('Send a new code in {time}', { time }),
            },
          }}
          error={state === 'error' ? 'The verification request could not be completed.' : error}
          timing={
            step === 'sent_email' ? { expiresInSeconds: 300, flowExpiresInSeconds: 900, resendInSeconds: 0 } : null
          }
          requestingCode={state === 'pending' && step === 'choose_email'}
          checkingApplication={state === 'pending' && step === 'applying'}
          submittingCode={state === 'pending' && step === 'sent_email'}
          onEmailChange={setEmail}
          onCodeChange={(value) => {
            setCode(value);
            setError(null);
          }}
          onBack={startOver}
          onStartOver={startOver}
          onPassed={() => setNotice('Verification completed.')}
          onCheckApplied={() => {
            if (state === 'ready') {
              setStep('passed');
            }
          }}
          onRequestCode={() => {
            if (state !== 'ready') {
              return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              setError('Enter a valid email.');
              return;
            }
            setError(null);
            setStep('sent_email');
          }}
          onResendCode={() => {
            if (state === 'ready') {
              setCode('');
              setError(null);
              setNotice('A new preview code is ready: 123456.');
            }
          }}
          onCodeSubmit={(value) => {
            if (state !== 'ready') {
              return;
            }
            if (value !== '123456') {
              setError('The verification code is invalid.');
              return;
            }
            setError(null);
            setStep('applying');
          }}
        />
      </fieldset>
    </PreviewFrame>,
    fixtureText,
  );
}
