// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import {
  normalizeSelectedParticipantRole,
  PostParticipantsDialogView,
  type PostParticipantsDialogViewProps,
} from './PostParticipantsDialogView';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

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

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
    ...overrides,
  };

  act(() => {
    root?.render(
      <MantineProvider env="test">
        <PostParticipantsDialogView {...props} />
      </MantineProvider>,
    );
  });
  return { onChangeRole, onRemove };
}

describe('PostParticipantsDialogView role changes', () => {
  it('lets an Admin atomically change either peer role', () => {
    const { onChangeRole } = renderView();
    const authorAction = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Change role to Collaborator"]',
    );
    const collaboratorAction = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Change role to Author"]',
    );

    expect(authorAction?.disabled).toBe(false);
    expect(collaboratorAction?.disabled).toBe(false);
    act(() => authorAction?.click());
    act(() => collaboratorAction?.click());
    expect(onChangeRole).toHaveBeenNthCalledWith(1, 'author-1', 'collaborator');
    expect(onChangeRole).toHaveBeenNthCalledWith(2, 'collaborator-1', 'author');
  });

  it('does not let a Post Author change another Author or demote the last Author', () => {
    renderView({ canRemoveAuthor: false });
    const peerAuthor = document.body.querySelector<HTMLElement>('[data-participant-id="author-1"]');
    expect(
      peerAuthor?.querySelector<HTMLButtonElement>('button[aria-label="Change role to Collaborator"]')?.disabled,
    ).toBe(true);
    expect(document.body.querySelector<HTMLButtonElement>('button[aria-label="Change role to Author"]')?.disabled).toBe(
      false,
    );

    act(() => root?.unmount());
    root = createRoot(container!);
    renderView({
      participants: [
        { memberId: 'author-1', nickname: 'Minji', role: 'author', hasEffectiveAuthority: true },
        { memberId: 'collaborator-1', nickname: 'Haru', role: 'collaborator', hasEffectiveAuthority: true },
      ],
    });
    const lastAuthor = document.body.querySelector<HTMLElement>('[data-participant-id="author-1"]');
    expect(
      lastAuthor?.querySelector<HTMLButtonElement>('button[aria-label="Change role to Collaborator"]')?.disabled,
    ).toBe(true);
    expect(lastAuthor?.querySelector<HTMLButtonElement>('button[aria-label="Remove author"]')?.disabled).toBe(true);
  });

  it('blocks role changes for inactive participants but still permits authorized removal', () => {
    const { onChangeRole, onRemove } = renderView({
      participants: [
        { memberId: 'author-1', nickname: 'Minji', role: 'author', hasEffectiveAuthority: true },
        { memberId: 'author-2', nickname: 'Alex', role: 'author', hasEffectiveAuthority: false },
      ],
    });
    const inactiveRow = document.body.querySelector<HTMLElement>('[data-participant-id="author-2"]');
    const changeRole = inactiveRow?.querySelector<HTMLButtonElement>(
      'button[aria-label="Change role to Collaborator"]',
    );
    const remove = inactiveRow?.querySelector<HTMLButtonElement>('button[aria-label="Remove author"]');
    const inactiveStatus = inactiveRow?.querySelector<HTMLElement>('[data-participant-inactive-status]');

    expect(changeRole?.disabled).toBe(true);
    expect(remove?.disabled).toBe(false);
    expect(inactiveStatus?.getAttribute('role')).toBe('img');
    expect(inactiveStatus?.getAttribute('aria-label')).toBe(labels.inactiveAuthority);
    expect(inactiveStatus?.closest('button')).toBeNull();
    expect(inactiveRow?.textContent).not.toContain(labels.inactiveAuthority);
    act(() => remove?.click());
    expect(onChangeRole).not.toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledWith('author-2', 'author');
  });

  it('normalizes a stale selected role to the roles the current actor may assign', () => {
    expect(normalizeSelectedParticipantRole('author', false, true)).toBe('collaborator');
    expect(normalizeSelectedParticipantRole('collaborator', true, false)).toBe('author');
    expect(normalizeSelectedParticipantRole('author', false, false)).toBeNull();
  });
});
