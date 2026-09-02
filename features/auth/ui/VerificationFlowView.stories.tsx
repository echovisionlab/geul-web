import type { Meta, StoryObj } from '@storybook/nextjs';

import { VerificationFlowView } from './VerificationFlowView';

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
  applyingTitle: 'Applying email change',
  sentDescription: 'Enter the six-digit code sent to the new address.',
  sentTitle: 'Check your email',
  submittingCode: 'Verifying code…',
};

const meta = {
  title: 'Feature/Auth/Verification Flow View',
  component: VerificationFlowView,
  parameters: { layout: 'centered' },
  args: {
    code: '',
    email: 'new@example.com',
    error: null,
    labels,
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

export const ChooseEmail: Story = {};

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

export const Applying: Story = {
  args: { state: 'applying', checkingApplication: true },
};

export const Passed: Story = {
  args: { state: 'passed' },
};
