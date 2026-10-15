import { afterEach, describe, expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  blockRoomIntentScopeKey,
  type BlockRoomIntentChange,
  type BlockRoomIntentScope,
} from './block-room-intent-journal';
import type { BlockRoomRecoverySnapshot } from './block-room-recovery';
import {
  boundRoomJournalRecord,
  createRoomJournalOwnerLiveness,
  createRoomJournalStore,
  type RoomJournalBackend,
  type RoomJournalRecord,
  type RoomJournalStore,
} from './room-journal-store';

type Scope = BlockRoomIntentScope;
type JournalRecord = RoomJournalRecord<Scope, BlockRoomIntentChange, BlockRoomRecoverySnapshot>;
type JournalStore = RoomJournalStore<Scope, BlockRoomIntentChange, BlockRoomRecoverySnapshot>;

const scope = { documentType: 'page', entityId: 'id', locale: 'en', sourceLocale: 'en' } as const;
const snapshot = { document: create(LocalizedPageDocumentSchema), baseNodes: [], localeOverlay: [] };
const change: BlockRoomIntentChange = {
  before: snapshot,
  after: snapshot,
  stateVector: new Uint8Array([0]),
  deleted: {},
};
const stores: JournalStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) {
    store.dispose();
  }
  vi.useRealTimers();
});
function fixture() {
  const records = new Map<string, JournalRecord>();
  const alive = new Set<string>();
  const backend: RoomJournalBackend<JournalRecord> = {
    put: vi.fn(async (record, removed = []) => {
      records.set(record.id, structuredClone(record));
      for (const id of removed) {
        if (id !== record.id) {
          records.delete(id);
        }
      }
    }),
    delete: vi.fn(async (id) => {
      records.delete(id);
    }),
    listAll: async () => [...records.values()],
    deleteMember: vi.fn(async (memberId) => {
      for (const [id, record] of records) {
        if (record.memberId === memberId) {
          records.delete(id);
        }
      }
    }),
    listByScope: async (key) => [...records.values()].filter((record) => record.scopeKey === key),
    take: async (id, expectedOwner, newOwner) => {
      const record = records.get(id);
      if (!record || record.tabId !== expectedOwner) {
        return null;
      }
      const adopted = { ...record, tabId: newOwner };
      records.set(id, adopted);
      return structuredClone(adopted);
    },
  };
  const member = { current: 'member-a' as string | null };
  const make = (tabId: string, onError = vi.fn()) => {
    const store = createRoomJournalStore<Scope, BlockRoomIntentChange, BlockRoomRecoverySnapshot>({
      backend,
      tabId,
      onError,
      scopeKey: blockRoomIntentScopeKey,
      memberId: () => member.current,
      titleOf: (journalScope) => (journalScope.locale === 'en' ? 'Night signals' : undefined),
      liveness: {
        hold: (id) => {
          alive.add(id);
        },
        whenOwnerGone: async (record, claim) => (alive.has(record.tabId) ? null : claim()),
      },
    });
    stores.push(store);
    return store;
  };
  return { records, backend, alive, make, member };
}
describe('durable room journal', () => {
  it('stores typed clocks and removes the record only after both intent and recovery clear', async () => {
    const f = fixture();
    const store = f.make('one');
    store.writeChanges(scope, [change]);
    await store.flush();
    expect([...f.records.values()][0]).toMatchObject({
      recordVersion: 1,
      scopeKey: blockRoomIntentScopeKey(scope),
      changes: [{ stateVector: new Uint8Array([0]) }],
    });
    store.writeChanges(scope, []);
    await store.flush();
    expect(f.records.size).toBe(0);
  });
  it('lets only one racing tab adopt a closed owner and retains the adopted data across a second crash', async () => {
    const f = fixture();
    const old = f.make('old');
    old.writeChanges(scope, [change]);
    await old.flush();
    old.dispose();
    f.alive.delete('old');
    const a = f.make('a');
    const b = f.make('b');
    const claimed = await Promise.all([a.claimOrphans(scope), b.claimOrphans(scope)]);
    expect(claimed.map((x) => x.records).sort()).toEqual([0, 1]);
    expect(f.records.size).toBe(1);
    expect([...f.records.values()][0]?.changes).toHaveLength(1);
    a.dispose();
    b.dispose();
    f.alive.clear();
    const next = f.make('next');
    expect((await next.claimOrphans(scope)).changes).toHaveLength(1);
    next.writeChanges(scope, []);
    await next.flush();
    expect(f.records.size).toBe(0);
  });
  it('never claims a live owner or another locale', async () => {
    const f = fixture();
    const live = f.make('live');
    live.writeChanges(scope, [change]);
    await live.flush();
    const next = f.make('next');
    expect((await next.claimOrphans(scope)).records).toBe(0);
    f.alive.delete('live');
    expect((await next.claimOrphans({ ...scope, locale: 'ko' })).records).toBe(0);
  });
  it('preserves a transferred record when consolidation fails', async () => {
    const f = fixture();
    const old = f.make('old');
    old.writeChanges(scope, [change]);
    await old.flush();
    f.alive.delete('old');
    vi.mocked(f.backend.put).mockRejectedValueOnce(new Error('quota'));
    const next = f.make('next');
    expect((await next.claimOrphans(scope)).records).toBe(1);
    expect([...f.records.values()][0]).toMatchObject({ tabId: 'next', changes: [change] });
    await next.flush();
    expect(f.records.size).toBe(1);
  });
  it('retries a failed first write and refuses payloads over the size bound', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const error = vi.fn();
    const store = f.make('one', error);
    vi.mocked(f.backend.put).mockRejectedValueOnce(new Error('quota'));
    store.writeChanges(scope, [change]);
    await store.flush();
    expect(error).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(f.records.size).toBe(1);
    expect(boundRoomJournalRecord({ changes: [change], recovery: null }, 1)).toBeNull();
  });
  it('retries cleanup without forgetting records after a failed delete', async () => {
    const f = fixture();
    const store = f.make('one');
    store.writeChanges(scope, [change]);
    await store.flush();
    vi.mocked(f.backend.delete).mockRejectedValueOnce(new Error('busy'));
    store.writeChanges(scope, []);
    await store.flush();
    expect(f.records.size).toBe(1);
    await store.flush();
    expect(f.records.size).toBe(0);
  });
  it('cleans adopted records when ACK arrives before failed consolidation can retry', async () => {
    const f = fixture();
    const old = f.make('old');
    old.writeChanges(scope, [change]);
    await old.flush();
    f.alive.delete('old');
    vi.mocked(f.backend.put).mockRejectedValueOnce(new Error('quota'));
    const next = f.make('next');
    await next.claimOrphans(scope);
    next.writeChanges(scope, []);
    await next.flush();
    expect(f.records.size).toBe(0);
  });
  it('preserves peer discontinuities when bounding a journal', () => {
    const peerSnapshot = { ...snapshot, document: create(LocalizedPageDocumentSchema, { locale: 'peer-update' }) };
    const second = { ...change, before: peerSnapshot, after: peerSnapshot };
    expect(boundRoomJournalRecord({ changes: [change, second], recovery: null }, 1 << 20)?.changes).toEqual([
      change,
      second,
    ]);
  });
  it('does not infer owner death from an old heartbeat without Web Locks', async () => {
    const f = fixture();
    const old = f.make('old');
    old.writeChanges(scope, [change]);
    await old.flush();
    const claim = vi.fn();
    const liveness = createRoomJournalOwnerLiveness({ locks: null });
    expect(await liveness.whenOwnerGone([...f.records.values()][0]!, claim)).toBeNull();
    expect(claim).not.toHaveBeenCalled();
  });
  it("records the member and adopts only that member's orphans", async () => {
    const f = fixture();
    const old = f.make('old');
    old.writeChanges(scope, [change]);
    await old.flush();
    expect([...f.records.values()][0]).toMatchObject({ memberId: 'member-a' });
    f.alive.delete('old');
    f.member.current = 'member-b';
    const other = f.make('other');
    expect((await other.claimOrphans(scope)).records).toBe(0);
    expect(f.records.size).toBe(1);
    f.member.current = 'member-a';
    const same = f.make('same');
    expect((await same.claimOrphans(scope)).changes).toEqual([change]);
  });
  it('persists nothing while the member is unknown or changed since the edits began', async () => {
    const f = fixture();
    f.member.current = null;
    const store = f.make('one');
    store.writeChanges(scope, [change]);
    await store.flush();
    expect(f.records.size).toBe(0);
    expect((await store.claimOrphans(scope)).records).toBe(0);

    f.member.current = 'member-a';
    const next = f.make('next');
    next.writeChanges(scope, [change]);
    f.member.current = 'member-b';
    await next.flush();
    expect(f.records.size).toBe(0);
  });
  it('deletes every record of a member on sign-out, leaving other members', async () => {
    const f = fixture();
    const a = f.make('a');
    a.writeChanges(scope, [change]);
    await a.flush();
    f.member.current = 'member-b';
    const b = f.make('b');
    b.writeChanges({ ...scope, locale: 'ko' }, [change]);
    await b.flush();
    expect(f.records.size).toBe(2);
    await a.clearMember('member-a');
    expect([...f.records.values()].map((record) => record.memberId)).toEqual(['member-b']);
    // The signed-out member's in-memory room no longer reaches durable storage.
    await a.flush();
    expect(f.records.size).toBe(1);
  });
  it('stores the title the editor shows, so local backups can name the document', async () => {
    const f = fixture();
    const store = f.make('one');
    store.writeChanges(scope, [change]);
    store.writeChanges({ ...scope, locale: 'ko' }, [change]);
    await store.flush();
    const byLocale = Object.fromEntries([...f.records.values()].map((record) => [record.scope.locale, record.title]));
    expect(byLocale).toEqual({ en: 'Night signals', ko: undefined });
  });
});
