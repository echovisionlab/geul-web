import { useTranslations } from 'next-intl';
import { navigatePreview, goBackPreview } from '@/stories/shared/preview-navigation';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useEffect, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { VerificationFlowView } from './VerificationFlowView';
import { PageLoader } from '@/features/site/PageLoader';

const labels = {
  back: 'Back',
  chooseDescription: 'The existing sign-in email remains active until the new address is verified.',
  chooseSubmit: 'Send verification code',
  chooseTitle: 'Change primary email',
  code: {
    codeAriaLabel: 'Verification code',
    codeExpired: 'This code has expired.',
    codeExpiresIn: (time: string) => `Code expires in ${time}`,
    flowExpired: 'This verification session has expired.',
    resend: 'Send a new code',
    resendIn: (time: string) => `Send a new code in ${time}`,
    startOver: 'Start over',
    submit: 'Verify code',
  },
  emailLabel: 'New email',
  emailPlaceholder: 'name@example.com',
  passedAction: 'Continue',
  passedDescription: 'Your primary email has been updated.',
  passedTitle: 'Email verified',
  applyingDescription: 'Verification succeeded. We are applying the email update.',
  applyingRetry: 'Check again',
  unavailableTitle: 'Unable to check the email change status. Please check again.',
  applyingTitle: 'Applying email change',
  sentDescription: 'Enter the six-digit code sent to the new address.',
  sentTitle: 'Check your email',
};

const meta = {
  title: 'Feature/Auth/Verification Flow View',
  component: VerificationFlowView,
  decorators: [
    withFeatureLabels({
      labels: {
        back: 'common.actions.back',
        chooseDescription: 'auth.verification.chooseMethod.description',
        chooseSubmit: 'auth.verification.chooseMethod.submit',
        chooseTitle: 'auth.verification.chooseMethod.title',
        emailLabel: 'common.labels.email',
        emailPlaceholder: 'common.placeholders.emailExample',
        passedAction: 'auth.verification.passedChallenge.action',
        passedDescription: 'auth.verification.passedChallenge.description',
        passedTitle: 'auth.verification.passedChallenge.title',
        applyingDescription: 'auth.verification.applying.description',
        applyingRetry: 'auth.verification.applying.checkAgain',
        applyingTitle: 'auth.verification.applying.title',
        unavailableTitle: 'auth.verification.unavailable',
        sentDescription: 'auth.verification.sentEmail.description',
        sentTitle: 'auth.common.checkYourEmailTitle',
        code: (t) => ({
          codeAriaLabel: t('auth.verification.sentEmail.codeLabel'),
          codeExpired: t('auth.common.codeTiming.expired'),
          codeExpiresIn: (time: string) => t('auth.common.codeTiming.expiresIn', { time }),
          flowExpired: t('auth.verification.errors.flowNotFound'),
          resend: t('auth.verification.sentEmail.resend'),
          resendIn: (time: string) => t('auth.common.codeTiming.resendIn', { time }),
          startOver: t('auth.verification.startOver'),
          submit: t('auth.verification.sentEmail.submitting'),
        }),
      },
      project: (args, t) => ({
        error: args.error
          ? t(args.state === 'sent_email' ? 'auth.verification.errors.submit' : 'auth.verification.errors.submitRetry')
          : args.error,
      }),
    }),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Verification uses Core input and action contracts. During OTP submission, the controller supplies the site PageLoader in a bounded flow region while the entered code remains mounted and disabled. Authority rechecks retain the applying or unavailable result and show the supplied loader in that result region. Resending has its own pending action. Back preserves its localized name, callback and keyboard focus without submitting the email form. These fixtures do not send email or reconcile a server session.',
      },
    },
  },
  render: function EditableVerificationState(args) {
    const t = useTranslations('auth.verification');
    const [email, setEmail] = useState(args.email);
    const [code, setCode] = useState(args.code);
    const [state, setState] = useState(args.state);
    const [error, setError] = useState(args.error);
    useEffect(() => setEmail(args.email), [args.email]);
    useEffect(() => setCode(args.code), [args.code]);
    useEffect(() => setState(args.state), [args.state]);
    useEffect(() => setError(args.error), [args.error]);
    return (
      <VerificationFlowView
        {...args}
        loadingSurface={
          <PageLoader placement="flow" message={t(args.checkingApplication ? 'checking' : 'sentEmail.submitting')} />
        }
        email={email}
        code={code}
        state={state}
        error={error}
        onEmailChange={(email) => {
          setEmail(email);
          args.onEmailChange(email);
        }}
        onCodeChange={(code) => {
          setCode(code);
          args.onCodeChange(code);
        }}
        onBack={goBackPreview}
        onCodeSubmit={(value) => {
          if (value !== '123456') {
            setError(t('errors.submit'));
            return;
          }
          setError(null);
          setState('passed');
          args.onCodeSubmit(code);
        }}
        onCheckApplied={() => {
          setState('passed');
          args.onCheckApplied();
        }}
        onPassed={() => navigatePreview('/my/security')}
        onRequestCode={() => {
          setState('sent_email');
          setCode('');
          args.onRequestCode();
        }}
        onResendCode={() => {
          setCode('');
          args.onResendCode();
        }}
        onStartOver={() => {
          setState('choose_email');
          setCode('');
          setError(null);
          args.onStartOver();
        }}
      />
    );
  },
  args: {
    code: '',
    email: 'new@example.com',
    error: null,
    labels,
    loadingSurface: null,
    onBack: () => {},
    onCodeChange: () => {},
    onCodeSubmit: () => {},
    onEmailChange: () => {},
    onPassed: () => {},
    onCheckApplied: () => {},
    onRequestCode: () => {},
    onResendCode: () => {},
    onStartOver: () => {},
    requestingCode: false,
    checkingApplication: false,
    state: 'choose_email',
    submittingCode: false,
    timing: null,
  },
} satisfies Meta<typeof VerificationFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChooseEmail: Story = {
  play: async ({ canvasElement }) => {
    const back = canvasElement.querySelector<HTMLButtonElement>('[data-testid="verification-back"]')!;
    await expect(back).toHaveAccessibleName();
    await expect(back.querySelector('svg')).toBeNull();
    await expect(back).toHaveAttribute('type', 'button');
  },
};

export const RequestingCode: Story = {
  args: { requestingCode: true },
};

export const AwaitingCode: Story = {
  args: { state: 'sent_email', code: '123' },
};

export const InvalidCode: Story = {
  args: {
    state: 'sent_email',
    code: '123456',
    error: 'The verification code is invalid.',
  },
};

export const SubmittingCode: Story = {
  args: { state: 'sent_email', code: '123456', submittingCode: true },
};

export const ResendingCode: Story = {
  args: { state: 'sent_email', code: '123', requestingCode: true },
};

export const Unavailable: Story = {
  args: { state: 'unavailable' },
};

export const Applying: Story = {
  args: { state: 'applying' },
};

export const RecheckingApplying: Story = { args: { state: 'applying', checkingApplication: true } };

export const RecheckingUnavailable: Story = { args: { state: 'unavailable', checkingApplication: true } };

export const Passed: Story = {
  args: { state: 'passed' },
};

export const KeyboardVerification: Story = {
  tags: ['a11y-account'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByRole('textbox');
    email.focus();
    await userEvent.clear(email);
    await userEvent.keyboard('reader@example.com{Enter}');
    await waitFor(() => expect(canvas.getAllByRole('textbox')).toHaveLength(6));
    await expect(canvas.getAllByRole('textbox')[0]).toHaveFocus();
    await userEvent.keyboard('123456');
    await waitFor(() => expect(canvas.queryAllByRole('textbox')).toHaveLength(0));
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveFocus();
    await expect(canvas.getByRole('button')).toHaveAccessibleName();
  },
};

export const KeyboardInvalidCode: Story = {
  tags: ['a11y-account'],
  args: { state: 'sent_email', code: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getAllByRole('textbox')[0].focus();
    await userEvent.keyboard('654321');
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible());
    const error = canvas.getByRole('alert');
    for (const digit of canvas.getAllByRole('textbox')) {
      await expect(digit).toHaveAttribute('aria-invalid', 'true');
      await expect(digit).toHaveAccessibleDescription(expect.stringContaining(error.textContent ?? ''));
    }
    await expect(
      canvas
        .getAllByRole('textbox')
        .map((input) => (input as HTMLInputElement).value)
        .join(''),
    ).toBe('654321');
  },
};
