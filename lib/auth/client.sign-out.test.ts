// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  announceSignOut: vi.fn<() => string | null>(() => 'member-a'),
  clearRoomJournalsForSignOut: vi.fn(),
  suspendEditorUnloadGuard: vi.fn(),
}));
vi.mock('@/lib/auth/active-member', () => ({ announceSignOut: mocks.announceSignOut }));
vi.mock('@/lib/collab/room-journal-store', () => ({ clearRoomJournalsForSignOut: mocks.clearRoomJournalsForSignOut }));
vi.mock('@/lib/editor/usePendingEditorUnload', () => ({ suspendEditorUnloadGuard: mocks.suspendEditorUnloadGuard }));
vi.mock('@/lib/actions/session', () => ({}));
vi.mock('@/lib/providers/SessionProvider', () => ({ useSessionContext: () => null }));

import { authClient, signOut } from './client';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.announceSignOut.mockReturnValue('member-a');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it.each([
  { name: 'signOut', run: signOut },
  { name: 'authClient.signOut', run: authClient.signOut },
])('$name stays pending until journal cleanup and logout navigation complete', async ({ run }) => {
  const location = { href: '/editor' };
  vi.stubGlobal('window', { location });
  const started = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<void>();
  mocks.clearRoomJournalsForSignOut.mockImplementation(() => {
    started.resolve();
    return cleanup.promise;
  });

  let completed = false;
  const completion = Promise.resolve(run()).then(() => {
    completed = true;
  });
  await started.promise;
  // Other tabs and this tab's backups observe the announcement (see active-member).
  expect(mocks.announceSignOut).toHaveBeenCalledOnce();
  expect(mocks.suspendEditorUnloadGuard).toHaveBeenCalledOnce();
  // The journal store loads on demand; the logout waits for it.
  try {
    expect(mocks.clearRoomJournalsForSignOut).toHaveBeenCalledWith('member-a');
    expect(completed).toBe(false);
    expect(location.href).toBe('/editor');
  } finally {
    cleanup.resolve();
    await completion;
  }
  expect(completed).toBe(true);
  expect(location.href).toBe('/api/auth/logout');
});

it('still completes logout navigation when journal cleanup rejects', async () => {
  const location = { href: '/editor' };
  vi.stubGlobal('window', { location });
  mocks.clearRoomJournalsForSignOut.mockRejectedValueOnce(new Error('journal unavailable'));

  await expect(signOut()).resolves.toBeUndefined();

  expect(location.href).toBe('/api/auth/logout');
});

it('completes logout without member cleanup when there is no active member', async () => {
  const location = { href: '/login' };
  vi.stubGlobal('window', { location });
  mocks.announceSignOut.mockReturnValueOnce(null);

  await expect(authClient.signOut()).resolves.toBeUndefined();

  expect(mocks.clearRoomJournalsForSignOut).not.toHaveBeenCalled();
  expect(location.href).toBe('/api/auth/logout');
});
