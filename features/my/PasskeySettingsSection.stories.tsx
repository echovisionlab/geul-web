import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageLoader } from '@/features/site/PageLoader';
import { PasskeySettingsView } from './PasskeySettingsSection';
const meta = {
  title: 'Feature/My/Passkey Settings',
  parameters: {
    docs: {
      description: {
        component:
          'Actual passkey settings view with supplied PageLoader and fixture credentials. Runtime preparation, browser ceremony pending, unsupported and failed list states are separate. No credentials are registered or removed.',
      },
    },
  },
  component: PasskeySettingsView,
  args: {
    passkeys: [],
    loading: false,
    error: null,
    removingId: null,
    registrationReady: false,
    registrationPending: false,
    registration: null,
    loadingSurface: <PageLoader extent="compact" placement="flow" size="sm" />,
    onAdd: () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof PasskeySettingsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = {};
export const Failed: Story = { args: { error: 'Could not load passkeys.' } };
export const RegistrationPending: Story = {
  args: {
    registrationReady: true,
    registrationPending: true,
    registration: { action: '#', csrfToken: 'fixture', createData: '{}' },
  },
};
export const Unsupported: Story = {
  args: {
    error: 'Passkeys are not supported by this browser.',
    registration: { action: '#', csrfToken: 'fixture', createData: '{}' },
  },
};
