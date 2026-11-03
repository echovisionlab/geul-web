import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { PageLoader } from '@/features/site/PageLoader';
import { PostParticipantsDialogView, type PostParticipantsDialogViewProps } from './ui/PostParticipantsDialogView';
import { usePostParticipantsDialogLabels } from './usePostParticipantsDialogLabels';

function Preview(args: Omit<PostParticipantsDialogViewProps, 'labels' | 'loadingSurface'>) {
  const labels = usePostParticipantsDialogLabels();
  const tErrors = useTranslations('common.errors');
  return (
    <PostParticipantsDialogView
      {...args}
      labels={labels}
      queryFailure={args.failed ? <Alert tone="danger">{tErrors('generic')}</Alert> : args.queryFailure}
      loadingSurface={<PageLoader placement="flow" />}
    />
  );
}
const meta = {
  title: 'Feature/Post/Participants Pending',
  component: Preview,
  args: {
    opened: true,
    onClose: () => undefined,
    participants: [
      { memberId: 'author-1', nickname: 'Mina', role: 'author', hasEffectiveAuthority: true },
      { memberId: 'author-2', nickname: 'Jules', role: 'author', hasEffectiveAuthority: true },
    ],
    candidates: [],
    searchQuery: '',
    selectedRole: 'author',
    canAddAuthor: true,
    canRemoveAuthor: true,
    canManageCollaborators: true,
    onSearchQueryChange: () => undefined,
    onSelectedRoleChange: () => undefined,
    onAdd: () => undefined,
    onRemove: () => undefined,
    onChangeRole: () => undefined,
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = { args: { participants: [], loading: true } };
export const Failure: Story = {
  args: { participants: [], failed: true },
};
export const Removing: Story = { args: { mutating: true, pendingAction: { memberId: 'author-2', action: 'remove' } } };
export const Adding: Story = { args: { mutating: true, searching: true, searchQuery: 'Mina' } };
