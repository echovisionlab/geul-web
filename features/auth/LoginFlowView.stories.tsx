import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/features/site/PageLoader';
import { LoginFlowView } from './LoginFlowView';
const meta = {
  title: 'Feature/Auth/Login Flow',
  parameters: {
    docs: {
      description: {
        component:
          'Actual login view with local flow data. Resending isolates its Core button state. Submitting retains the PIN and supplies the site loader with localized phase text; callbacks do not contact identity services.',
      },
    },
  },
  component: LoginFlowView,
  render: function LoginFlowPreview(args) {
    const t = useTranslations('auth.verification');
    return (
      <LoginFlowView {...args} loadingSurface={<PageLoader placement="flow" message={t('sentEmail.submitting')} />} />
    );
  },
  args: {
    flow: {
      id: 'fixture',
      ui: {
        nodes: [
          { type: 'input', group: 'code', attributes: { name: 'method', value: 'code' } },
          { type: 'input', group: 'code', attributes: { name: 'identifier', value: 'june@example.com' } },
          { type: 'input', group: 'code', attributes: { name: 'code', value: '' } },
        ],
      },
    },
    actionUrl: '#',
    newsletterIntent: false,
    securityReauthentication: false,
    email: 'june@example.com',
    code: '',
    codeTiming: { expiresInSeconds: 300, flowExpiresInSeconds: 600, resendInSeconds: 0 },
    passkeyLoading: false,
    passkeyReady: false,
    pendingAction: null,
    submitError: null,
    loadingSurface: null,
    onEmailChange: () => {},
    onCodeChange: () => {},
    onRequestCode: () => {},
    onSubmitCode: () => {},
    onResendCode: () => {},
    onPasskeyLogin: () => {},
    onSocialSubmit: () => {},
    onStartOver: () => {},
  },
} satisfies Meta<typeof LoginFlowView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Code: Story = {};
export const Resending: Story = { args: { pendingAction: 'resend' } };
export const Submitting: Story = { args: { pendingAction: 'email', code: '123456' } };
