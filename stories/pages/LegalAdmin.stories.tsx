import { expect, within } from 'storybook/test';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import { LegalEditorPreview } from './LegalEditorsPage.stories';
import { TermsListClient } from '@/app/admin/terms/TermsListClient';
import { PrivacyListClient } from '@/app/admin/privacy/PrivacyListClient';
import { PolicyVersionCreationPage } from '@/features/policy/PolicyVersionCreationPage';
import type { LegalPolicyListItem } from '@/features/policy/LegalPolicyListClient';
import { TERMS_STATUS } from '@/lib/policy-status';
const date = new Date('2026-10-01T00:00:00Z');
const versions: LegalPolicyListItem[] = [
  {
    id: 'policy-active',
    version: 3,
    revision: '3',
    title: 'Current policy',
    status: TERMS_STATUS.ACTIVE,
    effectiveFrom: date,
    effectiveUntil: null,
    createdAt: date,
    updatedAt: date,
  },
  {
    id: 'policy-draft',
    version: 4,
    revision: '1',
    title: 'Upcoming policy',
    status: TERMS_STATUS.DRAFT,
    effectiveFrom: null,
    effectiveUntil: null,
    createdAt: date,
    updatedAt: date,
  },
  {
    id: 'policy-archive',
    version: 2,
    revision: '5',
    title: 'Previous policy',
    status: TERMS_STATUS.ARCHIVED,
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveUntil: date,
    createdAt: date,
    updatedAt: date,
  },
];
export function LegalAdminPreview({
  policy = 'terms',
  state = 'ready',
  surface = 'list',
}: {
  policy?: 'terms' | 'privacy';
  state?: 'ready' | 'empty' | 'failed' | 'pending';
  surface?: 'list' | 'creation';
}) {
  const [client] = useState(() => new QueryClient());
  const [destination, setDestination] = useState<string | null>(null);
  const props = {
    initialVersions:
      state === 'empty'
        ? []
        : versions.map((version) => ({
            ...version,
            status: policy === 'privacy' ? version.status.replace('TERMS_STATUS_', 'PRIVACY_STATUS_') : version.status,
          })),
    createVersion: async () =>
      state === 'failed' ? { error: 'Unable to create local draft' } : { data: { id: 'local-draft' } },
    deleteVersion: async () => (state === 'failed' ? { error: 'Unable to delete local draft' } : {}),
  };
  if (surface === 'creation' && destination?.endsWith('?edit=true')) {
    return <LegalEditorPreview entity={policy} />;
  }
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        {surface === 'creation' && !destination ? (
          <PolicyVersionCreationPage
            policy={policy}
            navigate={setDestination}
            createVersion={async () => (state === 'pending' ? new Promise(() => {}) : props.createVersion())}
          />
        ) : policy === 'terms' ? (
          <TermsListClient {...props} />
        ) : (
          <PrivacyListClient {...props} />
        )}
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Legal Policies',
  excludeStories: ['LegalAdminPreview'],
  component: LegalAdminPreview,
  args: { policy: 'terms', state: 'ready', surface: 'list' },
  render: (args) => <LegalAdminPreview key={`${args.policy}:${args.state}:${args.surface}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual terms/privacy list and automatic draft-creation route surface. Create/delete actions are local; status, search, selection and dialogs use production code. Automatic creation navigation renders the actual editor or list destination within the same preview iframe. Backend version/revision CAS and permissions are outside.',
      },
    },
  },
} satisfies Meta<typeof LegalAdminPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Terms: Story = {};
export const TermsEmpty: Story = { args: { state: 'empty' } };
export const TermsActionFailed: Story = { args: { state: 'failed' } };
export const Privacy: Story = { args: { policy: 'privacy' } };
export const PrivacyEmpty: Story = { args: { policy: 'privacy', state: 'empty' } };
export const PrivacyActionFailed: Story = { args: { policy: 'privacy', state: 'failed' } };
export const TermsCreating: Story = { args: { surface: 'creation', state: 'pending' } };
export const TermsCreated: Story = {
  args: { surface: 'creation' },
  play: async ({ canvasElement }) => {
    const title = await within(canvasElement).findByDisplayValue('밤의 기록');
    await expect(title).toHaveAccessibleName();
  },
};
export const TermsCreationFailed: Story = {
  args: { surface: 'creation', state: 'failed' },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('table')).toBeInTheDocument();
  },
};
export const PrivacyCreating: Story = { args: { policy: 'privacy', surface: 'creation', state: 'pending' } };
export const PrivacyCreated: Story = { ...TermsCreated, args: { policy: 'privacy', surface: 'creation' } };
export const PrivacyCreationFailed: Story = {
  ...TermsCreationFailed,
  args: { policy: 'privacy', surface: 'creation', state: 'failed' },
};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
