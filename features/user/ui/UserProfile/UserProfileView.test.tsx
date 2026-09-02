// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileView, type UserProfileViewProps } from './UserProfileView';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const labels: UserProfileViewProps['labels'] = {
  title: 'User Profile',
  back: 'Back',
  socialLinks: 'Social links',
  banned: 'Banned',
  changeRole: 'Change Role',
  ban: 'Ban',
  unban: 'Unban',
  delete: 'Delete',
  banDialog: {
    title: 'Ban User',
    description: 'Ban June Han',
    reason: 'Ban reason',
    reasonPlaceholder: 'Enter a reason',
    confirm: 'Ban User',
    cancel: 'Cancel',
    close: 'Close',
  },
  roleDialog: {
    title: 'Change Role',
    role: 'Role',
    confirm: 'Update Role',
    cancel: 'Cancel',
    close: 'Close',
  },
  deleteDialog: {
    title: 'Delete User',
    description: 'Delete June Han',
    warning: 'This action cannot be undone.',
    confirm: 'Delete',
    cancel: 'Cancel',
    close: 'Close',
  },
};

function createProps(overrides: Partial<UserProfileViewProps> = {}): UserProfileViewProps {
  const events: UserProfileViewProps['events'] = {
    onBack: vi.fn(),
    onOpenBan: vi.fn(),
    onCloseBan: vi.fn(),
    onBanReasonChange: vi.fn(),
    onConfirmBan: vi.fn(),
    onUnban: vi.fn(),
    onOpenRole: vi.fn(),
    onCloseRole: vi.fn(),
    onRoleChange: vi.fn(),
    onConfirmRole: vi.fn(),
    onOpenDelete: vi.fn(),
    onCloseDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
  };

  return {
    profile: {
      name: 'June Han',
      initials: 'JH',
      avatarUrl: 'https://example.com/june.webp',
      roleLabel: 'Author',
      joinedLabel: 'Joined July 1, 2026',
      bio: 'Sound artist and researcher.',
      socialLinks: [
        {
          key: 'instagram',
          href: 'https://instagram.com/june',
          label: 'Instagram',
          platform: 'instagram',
        },
      ],
      banned: false,
      banReason: null,
      showAdminActions: false,
    },
    labels,
    dialogs: {
      ban: { opened: false, pending: false, error: null, reason: '' },
      role: {
        opened: false,
        pending: false,
        error: null,
        value: 'author',
        options: [
          { value: 'user', label: 'User' },
          { value: 'author', label: 'Author' },
          { value: 'admin', label: 'Admin' },
        ],
      },
      delete: { opened: false, pending: false, error: null },
    },
    events,
    ...overrides,
  };
}

function renderProfile(props: UserProfileViewProps) {
  act(() => {
    root.render(
      <MantineProvider>
        <UserProfileView {...props} />
      </MantineProvider>,
    );
  });
}

function findButton(name: string) {
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  expect(button, `button named ${name}`).toBeDefined();
  return button as HTMLButtonElement;
}

describe('UserProfileView', () => {
  it('renders a full public profile without administrator controls', () => {
    renderProfile(createProps());

    expect(document.body.textContent).toContain('June Han');
    expect(document.body.textContent).toContain('Author');
    expect(document.body.textContent).toContain('Joined July 1, 2026');
    expect(document.body.textContent).toContain('Sound artist and researcher.');
    expect(document.querySelector('a[aria-label="Instagram"]')?.getAttribute('href')).toBe(
      'https://instagram.com/june',
    );
    expect(document.querySelector('a[aria-label="Instagram"] svg')?.getAttribute('data-social-platform')).toBe(
      'instagram',
    );
    expect(document.querySelector('[data-user-profile-admin-actions]')).toBeNull();
  });

  it('does not render placeholders for sparse optional profile fields', () => {
    const props = createProps();
    renderProfile({
      ...props,
      profile: {
        ...props.profile,
        avatarUrl: null,
        roleLabel: null,
        joinedLabel: null,
        bio: null,
        socialLinks: [],
      },
    });

    expect(document.body.textContent).not.toContain('Joined');
    expect(document.body.textContent).not.toContain('Unknown');
    expect(document.querySelector('[role="list"][aria-label="Social links"]')).toBeNull();
  });

  it('renders banned administrator state and dispatches administrator actions', () => {
    const props = createProps();
    const adminProps = {
      ...props,
      profile: {
        ...props.profile,
        banned: true,
        banReason: 'Ban reason: repeated abuse',
        showAdminActions: true,
      },
    };
    renderProfile(adminProps);

    expect(document.body.textContent).toContain('Banned');
    expect(document.body.textContent).toContain('Ban reason: repeated abuse');

    act(() => {
      findButton('Change Role').click();
      findButton('Unban').click();
      findButton('Delete').click();
    });

    expect(props.events.onOpenRole).toHaveBeenCalledOnce();
    expect(props.events.onUnban).toHaveBeenCalledOnce();
    expect(props.events.onOpenDelete).toHaveBeenCalledOnce();
  });

  it('keeps a failed ban modal actionable and exposes the service error', () => {
    const props = createProps();
    renderProfile({
      ...props,
      dialogs: {
        ...props.dialogs,
        ban: {
          opened: true,
          pending: false,
          error: 'Unable to ban this user',
          reason: 'Policy violation',
        },
      },
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Unable to ban this user');
    expect((document.querySelector('input[value="Policy violation"]') as HTMLInputElement | null)?.disabled).toBe(
      false,
    );
    expect(findButton('Ban User').disabled).toBe(false);
  });

  it('locks the role modal while its command is pending', () => {
    const props = createProps();
    renderProfile({
      ...props,
      dialogs: {
        ...props.dialogs,
        role: { ...props.dialogs.role, opened: true, pending: true },
      },
    });

    expect(findButton('Update Role').disabled).toBe(true);
    expect((document.querySelector('input[role="combobox"]') as HTMLInputElement | null)?.disabled).toBe(true);
  });

  it('shows a failed delete command inside its confirmation modal', () => {
    const props = createProps();
    renderProfile({
      ...props,
      dialogs: {
        ...props.dialogs,
        delete: { opened: true, pending: false, error: 'Delete request failed' },
      },
    });

    expect(document.body.textContent).toContain('This action cannot be undone.');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Delete request failed');
    expect(findButton('Delete').disabled).toBe(false);
  });
});
