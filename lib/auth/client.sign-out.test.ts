// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  announceSignOut: vi.fn(() => 'member-a'),
  clearRoomJournalsForSignOut: vi.fn(),
  suspendEditorUnloadGuard: vi.fn(),
}));
vi.mock('@/lib/auth/active-member', () => ({ announceSignOut: mocks.announceSignOut }));
vi.mock('@/lib/collab/room-journal-store', () => ({ clearRoomJournalsForSignOut: mocks.clearRoomJournalsForSignOut }));
vi.mock('@/lib/editor/usePendingEditorUnload', () => ({ suspendEditorUnloadGuard: mocks.suspendEditorUnloadGuard }));
vi.mock('@/lib/actions/session', () => ({}));
vi.mock('@/lib/providers/SessionProvider', () => ({ useSessionContext: () => null }));

import { signOut } from './client';

const originalLocation = window.location;
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

it('ends the member everywhere and deletes their unsaved-edit journals before the logout flow', async () => {
  const location = { href: '/editor' };
  Object.defineProperty(window, 'location', { configurable: true, value: location });
  let finishClear!: () => void;
  mocks.clearRoomJournalsForSignOut.mockReturnValue(new Promise<void>((resolve) => (finishClear = resolve)));

  signOut();
  await Promise.resolve();
  // Other tabs and this tab's backups observe the announcement (see active-member).
  expect(mocks.announceSignOut).toHaveBeenCalledOnce();
  expect(mocks.suspendEditorUnloadGuard).toHaveBeenCalledOnce();
  expect(mocks.clearRoomJournalsForSignOut).toHaveBeenCalledWith('member-a');
  expect(location.href).toBe('/editor');

  finishClear();
  await vi.waitFor(() => expect(location.href).toBe('/api/auth/logout'));
});
