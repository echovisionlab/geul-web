// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import { PageLoaderView } from '@/components/core/LoadingSurface';
import {
  normalizeSelectedParticipantRole,
  PostParticipantsDialogView,
  type PostParticipantsDialogViewProps,
} from './PostParticipantsDialogView';

const labels: PostParticipantsDialogViewProps['labels'] = {
  title: 'Authors and collaborators',
  close: 'Close',
  addSectionLabel: 'Add participant',
  memberLabel: 'Member',
  searchPlaceholder: 'Search by name',
  typeAtLeast2Characters: 'Type at least 2 characters',
  noUsersFound: 'No users found',
  roleLabel: 'Role',
  author: 'Author',
  collaborator: 'Collaborator',
  empty: 'No participants',
  inactiveAuthority: 'This member has left.',
  lastAuthor: 'The last author cannot be removed.',
  removeAuthor: 'Remove author',
  adminOnlyRemoveAuthor: 'Only an admin can remove an author.',
  removeCollaborator: 'Remove collaborator',
  cannotRemoveCollaborator: 'Cannot remove collaborator',
  changeToAuthor: 'Change role to Author',
  changeToCollaborator: 'Change role to Collaborator',
  cannotChangeRole: 'You cannot change this role.',
  inactiveCannotChangeRole: 'An inactive participant cannot change roles.',
};

function renderView(overrides: Partial<PostParticipantsDialogViewProps> = {}) {
  const onChangeRole = vi.fn();
  const onRemove = vi.fn();
  const props: PostParticipantsDialogViewProps = {
    opened: true,
    onClose: vi.fn(),
    participants: [
      { memberId: 'author-1', nickname: 'Minji', role: 'author', hasEffectiveAuthority: true },
      { memberId: 'author-2', nickname: 'Alex', role: 'author', hasEffectiveAuthority: true },
      { memberId: 'collaborator-1', nickname: 'Haru', role: 'collaborator', hasEffectiveAuthority: true },
    ],
    candidates: [],
    searchQuery: '',
    selectedRole: 'author',
    canAddAuthor: true,
    canRemoveAuthor: true,
    canManageCollaborators: true,
    onSearchQueryChange: vi.fn(),
    onSelectedRoleChange: vi.fn(),
    onAdd: vi.fn(),
    onRemove,
    onChangeRole,
    labels,
    loadingSurface: <PageLoaderView placement="flow" imageAlt="Loading..." message="Loading..." />,
    ...overrides,
  };

  return { ...render(<PostParticipantsDialogView {...props} />), props, onChangeRole, onRemove };
}

describe('PostParticipantsDialogView role changes', () => {
  it('lets an admin atomically change either peer role', async () => {
    const { user, onChangeRole } = renderView();
    const author = within(screen.getByRole('group', { name: 'Minji Author' })).getByRole('button', {
      name: labels.changeToCollaborator,
    });
    const collaborator = screen.getByRole('button', { name: labels.changeToAuthor });
    expect(author).toBeEnabled();
    expect(collaborator).toBeEnabled();
    await user.click(author);
    await user.click(collaborator);
    expect(onChangeRole).toHaveBeenNthCalledWith(1, 'author-1', 'collaborator');
    expect(onChangeRole).toHaveBeenNthCalledWith(2, 'collaborator-1', 'author');
  });

  it('prevents peer-author changes and last-author removal', () => {
    const { props, rerender } = renderView({ canRemoveAuthor: false });
    expect(
      within(screen.getByRole('group', { name: 'Minji Author' })).getByRole('button', {
        name: labels.changeToCollaborator,
      }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: labels.changeToAuthor })).toBeEnabled();
    rerender(
      <PostParticipantsDialogView
        {...props}
        canRemoveAuthor
        participants={[props.participants[0]!, props.participants[2]!]}
      />,
    );
    const lastAuthor = within(screen.getByRole('group', { name: 'Minji Author' }));
    expect(lastAuthor.getByRole('button', { name: labels.changeToCollaborator })).toBeDisabled();
    expect(lastAuthor.getByRole('button', { name: labels.removeAuthor })).toBeDisabled();
  });

  it('prevents inactive role changes while allowing authorized removal', async () => {
    const { user, onChangeRole, onRemove } = renderView({
      participants: [
        { memberId: 'author-1', nickname: 'Minji', role: 'author', hasEffectiveAuthority: true },
        { memberId: 'author-2', nickname: 'Alex', role: 'author', hasEffectiveAuthority: false },
      ],
    });
    const row = within(screen.getByRole('group', { name: 'Alex Author' }));
    expect(row.getByRole('button', { name: labels.changeToCollaborator })).toBeDisabled();
    const remove = row.getByRole('button', { name: labels.removeAuthor });
    expect(remove).toBeEnabled();
    expect(row.getByRole('img', { name: labels.inactiveAuthority })).toBeVisible();
    expect(row.queryByRole('button', { name: labels.inactiveAuthority })).not.toBeInTheDocument();
    expect(screen.queryByText(labels.inactiveAuthority)).not.toBeInTheDocument();
    await user.click(remove);
    expect(onChangeRole).not.toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledWith('author-2', 'author');
  });

  it('shows loading and suppresses false empty on query failure', () => {
    const { props, rerender } = renderView({ loading: true, participants: [] });
    expect(screen.getByRole('status', { name: 'Loading...' })).toHaveTextContent('Loading...');
    expect(screen.queryByText(labels.empty)).not.toBeInTheDocument();
    rerender(
      <PostParticipantsDialogView {...props} loading={false} failed queryFailure={<div role="alert">Failed</div>} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.queryByText(labels.empty)).not.toBeInTheDocument();
  });

  it('marks only the active row action pending and gates member selection', async () => {
    const { props, user } = renderView({ mutating: true, pendingAction: { memberId: 'author-2', action: 'remove' } });
    const row = within(screen.getByRole('group', { name: 'Alex Author' }));
    expect(row.getByRole('button', { name: labels.removeAuthor })).toHaveAttribute('aria-busy', 'true');
    expect(
      within(screen.getByRole('group', { name: 'Minji Author' })).getByRole('button', { name: labels.removeAuthor }),
    ).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('combobox', { name: labels.memberLabel })).toBeDisabled();
    await user.click(row.getByRole('button', { name: labels.removeAuthor }));
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it('normalizes a stale role to the actor’s assignable roles', () => {
    expect(normalizeSelectedParticipantRole('author', false, true)).toBe('collaborator');
    expect(normalizeSelectedParticipantRole('collaborator', true, false)).toBe('author');
    expect(normalizeSelectedParticipantRole('author', false, false)).toBeNull();
  });
});
