import type { Meta, StoryObj } from '@storybook/nextjs';
import { Alert } from '@/components/core/Alert';
import { PageLoader } from '@/features/site/PageLoader';
import { LabelParticipantsDialogView } from './ui/LabelParticipantsDialogView';
import { useLabelParticipantsDialogLabels } from './useLabelParticipantsDialogLabels';

function ParticipantsPreview({ state }: { state: 'loading' | 'empty' | 'failed' | 'changing' }) {
  const labels = useLabelParticipantsDialogLabels();
  return (
    <LabelParticipantsDialogView
      opened
      onClose={() => {}}
      labels={labels}
      participants={
        state === 'changing'
          ? [{ memberId: 'manager', nickname: 'Mina', role: 'manager', hasEffectiveAuthority: true }]
          : []
      }
      candidates={[]}
      searchQuery=""
      selectedRole="manager"
      canManageParticipants
      canRemoveOwner
      loading={state === 'loading'}
      loadingSurface={<PageLoader placement="flow" />}
      loadFailed={state === 'failed'}
      queryFailure={
        state === 'failed' ? (
          <Alert tone="danger" role="alert">
            Failed to load participants.
          </Alert>
        ) : undefined
      }
      mutating={state === 'changing'}
      changingMemberId={state === 'changing' ? 'manager' : undefined}
      onSearchQueryChange={() => {}}
      onSelectedRoleChange={() => {}}
      onAdd={() => {}}
      onRemove={() => {}}
      onChangeRole={() => {}}
    />
  );
}
const meta = {
  title: 'Feature/Label/Participants Wait',
  component: ParticipantsPreview,
  parameters: {
    docs: {
      description: {
        component:
          'Production participant view with controller-supplied site loading surface. Requests and permissions are fixtures; loading, empty, failure and row command pending remain separate.',
      },
    },
  },
  args: { state: 'loading' },
} satisfies Meta<typeof ParticipantsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'failed' } };
export const ChangingRole: Story = { args: { state: 'changing' } };
