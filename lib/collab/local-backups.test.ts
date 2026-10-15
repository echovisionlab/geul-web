import { describe, expect, it, vi } from 'vitest';
import { createLocalBackupRepository } from './local-backups';
import {
  ROOM_JOURNAL_DATABASES,
  ROOM_JOURNAL_LIMITS,
  type RoomJournalCatalogBackend,
  type RoomJournalRecord,
} from './room-journal-store';

const entityId = '11111111-1111-4111-8111-111111111111';
const now = 1_800_000_000_000;
type Record = RoomJournalRecord<unknown, unknown, unknown>;
function record(id: string, overrides: Partial<Record> = {}): Record {
  return {
    id,
    recordVersion: 1,
    scopeKey: 'scope',
    scope: { documentType: 'post', entityId, locale: 'ko' },
    memberId: 'member',
    tabId: id,
    changes: [{}],
    recovery: null,
    compacted: false,
    updatedAt: now,
    heartbeatAt: now,
    ...overrides,
  };
}
function fixture(records: Record[], live = new Set<string>()) {
  const state = new Map(records.map((entry) => [entry.id, entry]));
  const backend: RoomJournalCatalogBackend = {
    read: vi.fn(async (id) => state.get(id) ?? null),
    listByMember: vi.fn(async () => [...state.values()]),
    listAll: vi.fn(async () => [...state.values()]),
    listByScope: vi.fn(async () => []),
    put: vi.fn(async (entry) => {
      state.set(entry.id, entry);
    }),
    delete: vi.fn(async (id) => {
      state.delete(id);
    }),
    deleteMember: vi.fn(async () => {}),
    take: vi.fn(async () => null),
  };
  let member: string | null = 'member';
  const repository = createLocalBackupRepository({
    backends: new Map([[ROOM_JOURNAL_DATABASES.blockRoom, backend]]),
    liveness: { hold: vi.fn(), whenOwnerGone: async (owner, claim) => (live.has(owner.tabId) ? null : claim()) },
    memberId: () => member,
    now: () => now,
  });
  return {
    backend,
    state,
    repository,
    setMember: (value: string | null) => {
      member = value;
    },
  };
}

describe('local backups', () => {
  it('lists only this member’s usable orphan journals, newest first, without claiming', async () => {
    const f = fixture(
      [
        record('older', { updatedAt: now - 100 }),
        record('newer'),
        record('other', { memberId: 'other-member' }),
        record('expired', { updatedAt: now - ROOM_JOURNAL_LIMITS.maxAgeMs - 1 }),
        record('empty', { changes: [] }),
        record('invalid', { scope: { documentType: 'post', entityId: '../../bad', locale: 'ko' } }),
        record('live'),
      ],
      new Set(['live']),
    );
    expect((await f.repository.list()).map((entry) => entry.id)).toEqual(['newer', 'older']);
    expect(f.backend.take).not.toHaveBeenCalled();
    expect(f.backend.delete).not.toHaveBeenCalled();
    f.setMember(null);
    expect(await f.repository.list()).toEqual([]);
  });
  it('uses geul-common document names for document rooms and preserves exact locale', async () => {
    const f = fixture([]);
    f.state.set('doc', record('doc', { scope: { documentName: `email-layout:${entityId}:en` } }));
    const repository = createLocalBackupRepository({
      backends: new Map([[ROOM_JOURNAL_DATABASES.documentRoom, f.backend]]),
      liveness: { hold: vi.fn(), whenOwnerGone: async (_, claim) => claim() },
      memberId: () => 'member',
      now: () => now,
    });
    expect(await repository.list()).toMatchObject([{ documentKind: 'email-layout', entityId, locale: 'en' }]);
  });
  it('fails closed when Web Locks cannot prove the owner is gone', async () => {
    const f = fixture([record('closed')]);
    const repository = createLocalBackupRepository({
      backends: new Map([[ROOM_JOURNAL_DATABASES.blockRoom, f.backend]]),
      liveness: { hold: vi.fn(), whenOwnerGone: async () => null },
      memberId: () => 'member',
      now: () => now,
    });
    expect(await repository.list()).toEqual([]);
  });
  it('discards the exact orphan and refuses another member or a newly live/adopted owner', async () => {
    const live = new Set<string>();
    const f = fixture([record('one'), record('two')], live);
    const [one, two] = await f.repository.list();
    expect(await f.repository.discard(one!)).toBe(true);
    expect(f.state.has('one')).toBe(false);
    live.add('two');
    expect(await f.repository.discard(two!)).toBe(false);
    live.clear();
    f.state.set('two', record('two', { tabId: 'adopted-by-editor' }));
    expect(await f.repository.discard(two!)).toBe(false);
    f.state.set('two', record('two', { memberId: 'other-member' }));
    expect(await f.repository.discard(two!)).toBe(false);
    expect(f.backend.delete).toHaveBeenCalledTimes(1);
  });
  it('drops results if the member signs out during an IndexedDB read', async () => {
    const f = fixture([record('one')]);
    vi.mocked(f.backend.listByMember).mockImplementation(async () => {
      f.setMember(null);
      return [...f.state.values()];
    });
    expect(await f.repository.list()).toEqual([]);
  });
  it('excludes a record adopted between the initial read and the owner-lock check', async () => {
    const f = fixture([record('one')]);
    const repository = createLocalBackupRepository({
      backends: new Map([[ROOM_JOURNAL_DATABASES.blockRoom, f.backend]]),
      liveness: {
        hold: vi.fn(),
        whenOwnerGone: async (_, claim) => {
          f.state.set('one', record('one', { tabId: 'live-editor' }));
          return claim();
        },
      },
      memberId: () => 'member',
      now: () => now,
    });
    expect(await repository.list()).toEqual([]);
  });
});
