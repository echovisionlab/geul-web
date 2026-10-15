// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type RecoveryModule = typeof import('./editor-save-recovery');
type MemberModule = typeof import('@/lib/auth/active-member');

/** A fresh page of this tab: module state is new, session storage is the tab's. */
async function freshPage(memberId: string | null): Promise<RecoveryModule & MemberModule> {
  vi.resetModules();
  const member = await import('@/lib/auth/active-member');
  if (memberId) {
    member.syncActiveMember(memberId);
  }
  return { ...(await import('./editor-save-recovery')), ...member };
}

const entry = { document: 'post:one', updatedAt: 1, patch: { slug: 'draft' }, recoveryKey: 'config' };

beforeEach(() => window.sessionStorage.clear());
afterEach(() => window.sessionStorage.clear());

it('restores a tab backup only for the member who made it', async () => {
  const first = await freshPage('member-a');
  expect(first.persistEditorSaveRecoveryEntry('post:one:en', 'queue-a', entry)).toBe(true);

  const other = await freshPage('member-b');
  expect(other.claimEditorSaveRecoveryEntries('post:one:en', 'queue-b', 'post:one', 'config')).toEqual([]);

  const same = await freshPage('member-a');
  expect(same.claimEditorSaveRecoveryEntries('post:one:en', 'queue-c', 'post:one', 'config')).toEqual([
    expect.objectContaining({ patch: { slug: 'draft' } }),
  ]);
});

it('keeps backups in memory only while no member is known, and drops them when the member signs out', async () => {
  const anonymous = await freshPage(null);
  anonymous.persistEditorSaveRecoveryEntry('post:one:en', 'queue-a', entry);
  expect(window.sessionStorage.length).toBe(0);

  const page = await freshPage('member-a');
  page.persistEditorSaveRecoveryEntry('post:one:en', 'queue-a', entry);
  expect(window.sessionStorage.length).toBe(1);
  page.announceSignOut();
  expect(window.sessionStorage.length).toBe(0);
  page.resetActiveMemberForTests();
});

it('reports a backup as durable only when it reached session storage', async () => {
  const page = await freshPage('member-a');
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  try {
    expect(page.persistEditorSaveRecoveryEntry('post:one:en', 'queue-a', entry)).toBe(false);
  } finally {
    setItem.mockRestore();
  }
  expect(page.persistEditorSaveRecoveryEntry('post:one:en', 'queue-a', entry)).toBe(true);
  page.resetActiveMemberForTests();
});
