// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfileViewProps as UserProfileFeatureViewProps } from '@/features/user/ui/UserProfile';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import enMessages from '@/messages/en.json';
import { UserProfileView, type UserProfileViewUser } from './UserProfileView';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  showNotification: vi.fn(),
  banUser: vi.fn(),
  deleteUser: vi.fn(),
  unbanUser: vi.fn(),
  updateUser: vi.fn(),
}));

let capturedViewProps: UserProfileFeatureViewProps | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mocks.back, push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.showNotification },
}));

vi.mock('@/lib/actions/user', () => ({
  banUserAction: mocks.banUser,
  deleteUserAction: mocks.deleteUser,
  unbanUserAction: mocks.unbanUser,
  updateUserAction: mocks.updateUser,
}));

vi.mock('@/features/user/ui/UserProfile', () => ({
  UserProfileView: (props: UserProfileFeatureViewProps) => {
    capturedViewProps = props;
    return <div data-user-profile-view />;
  },
}));

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

const baseUser: UserProfileViewUser = {
  id: 'user-1',
  name: 'Public User',
  image: null,
  bio: 'Hello world',
  social_links: { instagram: 'https://instagram.com/example-studio' },
  role: 'author',
  banned: false,
  ban_reason: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  isAdmin: false,
  isSelf: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  capturedViewProps = null;
  mocks.banUser.mockResolvedValue({ success: true });
  mocks.deleteUser.mockResolvedValue({ success: true });
  mocks.unbanUser.mockResolvedValue({ success: true });
  mocks.updateUser.mockResolvedValue({ success: true });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  queryClient.clear();
});

function renderController(user: UserProfileViewUser = baseUser) {
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <LocaleProvider locale="en">
            <UserProfileView user={user} />
          </LocaleProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  });
}

function viewProps() {
  expect(capturedViewProps).not.toBeNull();
  return capturedViewProps as UserProfileFeatureViewProps;
}

async function settleMutation() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('UserProfileView controller', () => {
  it('maps service data to localized and display-ready UI props', () => {
    renderController();

    expect(viewProps().profile).toMatchObject({
      name: 'Public User',
      initials: 'PU',
      roleLabel: 'Author',
      joinedLabel: 'Joined 1/1/2026',
      bio: 'Hello world',
      showAdminActions: false,
    });
    expect(viewProps().profile.socialLinks).toEqual([
      expect.objectContaining({
        href: 'https://instagram.com/example-studio',
        label: 'Instagram',
        platform: 'instagram',
      }),
    ]);
    expect(viewProps().labels.back).toBe('Back');
  });

  it('keeps administrator actions hidden for an administrator viewing their own profile', () => {
    renderController({ ...baseUser, isAdmin: true, isSelf: true });

    expect(viewProps().profile.showAdminActions).toBe(false);
  });

  it('updates a role, invalidates the profile query, and refreshes server data', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderController({ ...baseUser, isAdmin: true });

    act(() => {
      viewProps().events.onOpenRole();
      viewProps().events.onRoleChange('admin');
    });
    act(() => viewProps().events.onConfirmRole());
    await settleMutation();

    expect(mocks.updateUser).toHaveBeenCalledWith('user-1', { role: 'admin' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user', 'profile', 'user-1'] });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.showNotification).toHaveBeenCalledWith({ message: 'Role updated', color: 'green' });
  });

  it('keeps a failed ban modal open and passes its service error to the UI', async () => {
    mocks.banUser.mockResolvedValue({ error: 'Ban failed at the service' });
    renderController({ ...baseUser, isAdmin: true });

    act(() => {
      viewProps().events.onOpenBan();
      viewProps().events.onBanReasonChange('Policy violation');
    });
    act(() => viewProps().events.onConfirmBan());
    await settleMutation();

    expect(mocks.banUser).toHaveBeenCalledWith('user-1', 'Policy violation');
    expect(viewProps().dialogs.ban.opened).toBe(true);
    expect(viewProps().dialogs.ban.error).toBe('Ban failed at the service');
    expect(mocks.showNotification).toHaveBeenCalledWith({
      message: 'Ban failed at the service',
      color: 'red',
    });
  });

  it('redirects a deleted user to the existing administrator users route', async () => {
    renderController({ ...baseUser, isAdmin: true });

    act(() => viewProps().events.onOpenDelete());
    expect(viewProps().dialogs.delete.opened).toBe(true);

    act(() => viewProps().events.onConfirmDelete());
    await settleMutation();

    expect(mocks.deleteUser).toHaveBeenCalledWith('user-1');
    expect(mocks.push).toHaveBeenCalledWith('/admin/users');
    expect(mocks.push).not.toHaveBeenCalledWith('/users');
  });
});
