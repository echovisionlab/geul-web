// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import AdminUserEditPage from '@/features/admin/user/AdminUserEditPage';
import { adminUserFixture } from '@/stories/pages/fixtures/admin-user';
import { render, screen, waitFor } from '@/test/render';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin/users/member-1',
  useSearchParams: () => new URLSearchParams(),
}));
// The uploader stores the file through the upload and avatar actions; the page owns only what follows once it
// reports the new avatar.
vi.mock('@/features/user/UserAvatarUploader', () => ({
  UserAvatarUploader: ({ onImageChange }: { onImageChange?: (url: string | null) => Promise<void> }) => (
    <button type="button" onClick={() => void onImageChange?.('https://cdn.example/member.webp')}>
      Replace avatar
    </button>
  ),
}));

it('refetches the exact Member after an avatar change without issuing a generic profile update', async () => {
  const fixture = adminUserFixture('ready');
  const getUserAdminAction = vi.fn(fixture.getUserAdminAction);
  const updateUserAction = vi.fn(fixture.updateUserAction);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { user } = render(
    <QueryClientProvider client={client}>
      <AdminUserEditPage
        id="member-1"
        bindings={{ ...fixture, getUserAdminAction, updateUserAction }}
        checkNickname={async () => ({ available: true })}
      />
    </QueryClientProvider>,
  );

  // An avatar change happens on a loaded profile; a refetch of a still-pending load would join it.
  const replaceAvatar = await screen.findByRole('button', { name: 'Replace avatar' });
  expect(getUserAdminAction).toHaveBeenCalledTimes(1);

  await user.click(replaceAvatar);

  await waitFor(() => expect(getUserAdminAction).toHaveBeenCalledTimes(2));
  expect(getUserAdminAction).toHaveBeenLastCalledWith('member-1');
  expect(updateUserAction).not.toHaveBeenCalled();
});

it('keeps an unonboarded Member draft across refresh and saves only the edited profile field', async () => {
  const fixture = adminUserFixture('ready');
  const loaded = await fixture.getUserAdminAction('member-1');
  if (!loaded.ok || !loaded.value) {
    throw new Error('Member fixture is missing');
  }
  const member = { ...loaded.value, id: 'member-1', role: 'user' as const, onboarded: false };
  const read = vi.fn(async () => ({ ok: true as const, value: member }));
  let finishSave!: (result: { success: boolean }) => void;
  const save = new Promise<{ success: boolean }>((resolve) => {
    finishSave = resolve;
  });
  const update = vi.fn(() => save);
  let finishRefetch!: (result: { ok: true; value: typeof member }) => void;
  const refetch = new Promise<{ ok: true; value: typeof member }>((resolve) => {
    finishRefetch = resolve;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <AdminUserEditPage
        id="member-1"
        bindings={{ ...fixture, getUserAdminAction: read, updateUserAction: update }}
        checkNickname={async () => ({ available: true })}
      />
    </QueryClientProvider>,
  );
  try {
    const bio = await screen.findByRole('textbox', { name: /Bio/ });
    await waitFor(() => expect(bio).toHaveValue(member.bio));
    await view.user.clear(bio);
    await view.user.paste('Temporary bio');
    act(() => client.setQueryData(['users', 'admin', 'member-1'], { ...member, bio: 'Changed elsewhere' }));
    expect(bio).toHaveValue('Temporary bio');
    await view.user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledWith('member-1', {
      id: 'member-1',
      bio: 'Temporary bio',
      social_links: undefined,
      tag_ids: undefined,
    });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true');
    act(() =>
      client.setQueryData(['users', 'admin', 'member-1'], {
        ...member,
        nickname: 'Peer update',
        bio: 'Refreshed during save',
      }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Peer update' })).toBeInTheDocument();
    expect(bio).toHaveValue('Temporary bio');
    // Keep the same query snapshot while the mutation settles, as before its refetch returns.
    read.mockReturnValueOnce(refetch);
    await act(async () => {
      finishSave({ success: true });
      await save;
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(read).toHaveBeenCalledTimes(2);
    expect(bio).toHaveValue('Temporary bio');
  } finally {
    view.unmount();
    await act(async () => {
      finishSave({ success: true });
      finishRefetch({ ok: true, value: member });
      await Promise.all([save, refetch]);
    });
    client.clear();
  }
});
