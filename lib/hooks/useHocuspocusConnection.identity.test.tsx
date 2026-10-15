// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import { formRootTitleTarget, formStepDescriptionTarget } from '@echovisionlab/geul-proto/intra/form_locale_catalog.ts';
import {
  FORM_FIELDS_MAP_NAME,
  FORM_LOCALE_PRESENCE_MAP_NAME,
  hydrateFormCanonicalRoom,
} from '@echovisionlab/geul-common/collaboration/form';
import {
  hydrateMenuCanonicalRoom,
  MENU_ITEMS_MAP_NAME,
  setMenuLocaleLabel,
  type MenuCollaborationItem,
} from '@echovisionlab/geul-common/collaboration/menu';
import { DOCUMENT_ROOM_SNAPSHOT_KEYS, DOCUMENT_ROOM_SNAPSHOT_MAP_NAME } from '@/lib/collab/document-room-snapshot';
import { flushEditorSaves, hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
import { captureDocumentRoomSnapshot, type MenuDocumentRoomIntentSnapshot } from '@/lib/collab/document-room-intent';
import * as documentRoomJournalStore from '@/lib/collab/document-room-journal-store';
import { useFormEditorCollaboration } from './useFormEditorCollaboration';
import { useHocuspocusConnection } from './useHocuspocusConnection';

const persistNowMock = vi.hoisted(() => vi.fn(async (_provider: unknown): Promise<void> => undefined));

vi.mock('@/lib/collab/persist-now', () => ({
  persistCollaborativeDocumentNow: persistNowMock,
}));

const providerState = vi.hoisted(() => ({
  instances: [] as Array<{
    configuration: {
      name: string;
      document: Y.Doc;
      onConnect?: () => void;
      onSynced?: () => void;
      onAuthenticationFailed?: (event: { reason: string }) => void;
    };
    destroy: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    emit: (event: string, payload?: unknown) => void;
  }>,
}));

vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: class MockHocuspocusProvider {
    readonly configuration: (typeof providerState.instances)[number]['configuration'];
    destroy = vi.fn();
    disconnect = vi.fn();
    connect = vi.fn();
    private readonly listeners = new Map<string, Set<(payload?: unknown) => void>>();
    on = vi.fn((event: string, listener: (payload?: unknown) => void) => {
      const listeners = this.listeners.get(event) ?? new Set();
      listeners.add(listener);
      this.listeners.set(event, listeners);
    });
    off = vi.fn((event: string, listener: (payload?: unknown) => void) => {
      this.listeners.get(event)?.delete(listener);
    });
    emit(event: string, payload?: unknown) {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(payload);
      }
    }

    constructor(configuration: (typeof providerState.instances)[number]['configuration']) {
      this.configuration = configuration;
      providerState.instances.push(this);
    }
  },
}));

const entityId = '11111111-1111-4111-8111-111111111111';
const documentRevision = '22222222-2222-4222-8222-222222222222';
const targetRevision = '33333333-3333-4333-8333-333333333333';
const nextDocumentRevision = '44444444-4444-4444-8444-444444444444';
const snapshots: Array<{ name: string; connection: ReturnType<typeof useHocuspocusConnection> }> = [];
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let latestFormEditor: ReturnType<typeof useFormEditorCollaboration> | null = null;

function Harness({ locale }: { locale: string }) {
  const name = `email-layout:${entityId}:${locale}`;
  const connection = useHocuspocusConnection({ documentName: name });
  snapshots.push({ name, connection });
  return null;
}

function ReloadHarness({
  documentName,
  onReloadRequired,
}: {
  documentName: string;
  onReloadRequired?: (reloadCanonical: () => boolean) => void;
}) {
  const connection = useHocuspocusConnection({ documentName, onReloadRequired });
  snapshots.push({ name: documentName, connection });
  return null;
}

function FormEditorHarness({ locale }: { locale: string }) {
  latestFormEditor = useFormEditorCollaboration(entityId, locale);
  return null;
}

beforeEach(() => {
  providerState.instances.length = 0;
  snapshots.length = 0;
  latestFormEditor = null;
  persistNowMock.mockReset();
  persistNowMock.mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

function seedMenuRoom(document: Y.Doc, locale: string, items: MenuCollaborationItem[]) {
  const documentName = createDocumentName(CollaborativeDocumentType.MENU, entityId, locale);
  const canonical = hydrateMenuCanonicalRoom({
    sourceLocale: 'en',
    locale,
    localeExists: true,
    name: 'Main menu',
    items,
    sourceLabels: Object.fromEntries(items.map((item) => [item.id, item.label ?? item.id])),
    requestedLabels: {},
  });
  const marker = canonical.getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentName, documentName);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentRevision, documentRevision);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.sourceLocale, 'en');
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.locale, locale);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.localeExists, true);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.targetRevision, targetRevision);
  const update = Y.encodeStateAsUpdate(canonical);
  Y.applyUpdate(document, update, 'server-seed');
  canonical.destroy();
}

function seedFormRoom(
  document: Y.Doc,
  locale: string,
  title: string | null,
  schema: { id: string; steps: unknown[] },
  revision = documentRevision,
  presentLocaleValues = title === null ? [] : [formRootTitleTarget()],
) {
  const documentName = createDocumentName(CollaborativeDocumentType.FORM, entityId, locale);
  const canonical = hydrateFormCanonicalRoom({
    sourceLocale: 'en',
    locale,
    source: { title: 'Server form', schema },
    requested: { ...(title === null ? {} : { title }), schema },
    requestedExists: true,
    presentLocaleValues,
  });
  const marker = canonical.getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentName, documentName);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentRevision, revision);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.sourceLocale, 'en');
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.locale, locale);
  marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.localeExists, true);
  if (locale !== 'en') {
    marker.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.targetRevision, targetRevision);
  }
  Y.applyUpdate(document, Y.encodeStateAsUpdate(canonical), 'server-seed');
  canonical.destroy();
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('useHocuspocusConnection request identity', () => {
  it('masks the previous document synchronously when documentName changes', async () => {
    await act(async () => {
      root?.render(<Harness locale="en" />);
      await Promise.resolve();
    });
    const first = providerState.instances[0]!;
    act(() => {
      first.configuration.onConnect?.();
      first.configuration.onSynced?.();
    });
    expect(snapshots.at(-1)?.connection).toMatchObject({
      provider: first,
      doc: first.configuration.document,
      isConnected: true,
      isSynced: true,
    });

    await act(async () => {
      root?.render(<Harness locale="ko" />);
      await Promise.resolve();
    });

    const firstKoreanRender = snapshots.find((snapshot) => snapshot.name.endsWith(':ko'));
    expect(firstKoreanRender?.connection).toMatchObject({
      provider: null,
      doc: null,
      isConnected: false,
      isSynced: false,
    });
    expect(providerState.instances.at(-1)?.configuration.name).toBe(`email-layout:${entityId}:ko`);
    expect(snapshots.at(-1)?.connection.doc).not.toBe(first.configuration.document);
    expect(snapshots.at(-1)?.connection.isSynced).toBe(false);

    act(() => first.configuration.onSynced?.());
    expect(snapshots.at(-1)?.connection.isSynced).toBe(false);
  });

  it('recreates a fresh canonical map-theme document for a scoped reload-required signal', async () => {
    const documentName = `map-theme:${entityId}:und`;
    const onReloadRequired = vi.fn((reloadCanonical: () => boolean) => {
      expect(reloadCanonical()).toBe(true);
    });

    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} onReloadRequired={onReloadRequired} />);
      await Promise.resolve();
    });

    const first = providerState.instances[0]!;
    act(() => {
      first.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      });
    });

    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(onReloadRequired).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(providerState.instances[1]?.configuration.name).toBe(documentName);
    expect(providerState.instances[1]?.configuration.document).not.toBe(first.configuration.document);
    expect(snapshots.at(-1)?.connection.doc).toBe(providerState.instances[1]?.configuration.document);
  });

  it('automatically rebuilds an exact Form room from canonical state on reload-required', async () => {
    const documentName = `form:${entityId}:ko`;

    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });

    const first = providerState.instances[0]!;
    act(() => {
      first.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      });
    });

    const second = providerState.instances[1]!;
    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(second.configuration.name).toBe(documentName);
    expect(second.configuration.document).not.toBe(first.configuration.document);
    expect(snapshots.at(-1)?.connection).toMatchObject({
      provider: second,
      doc: second.configuration.document,
      isConnected: false,
      isSynced: false,
    });
    expect(snapshots.at(-1)?.connection.reloadCanonical()).toBe(true);
  });

  it('replays a pending Form title over a canonical schema change and clears it after durable persistence', async () => {
    await act(async () => {
      root?.render(<FormEditorHarness locale="en" />);
      await Promise.resolve();
    });

    const first = providerState.instances[0]!;
    const originalSchema = { id: 'schema-1', steps: [{ id: 'step-1', fields: [] }] };
    seedFormRoom(first.configuration.document, 'en', 'Server form', originalSchema);
    act(() => first.configuration.onSynced?.());
    await act(async () => {
      await Promise.resolve();
    });
    act(() => latestFormEditor?.setField('title', 'Local title'));
    expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(true);

    act(() =>
      first.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );
    const second = providerState.instances[1]!;
    const peerSchema = {
      id: 'schema-1',
      steps: [{ id: 'step-1', description: 'Peer schema edit', fields: [] }],
    };
    let acknowledgePersistence!: () => void;
    persistNowMock.mockImplementationOnce(() => new Promise<void>((resolve) => (acknowledgePersistence = resolve)));
    seedFormRoom(second.configuration.document, 'en', 'Server form', peerSchema, nextDocumentRevision, [
      formRootTitleTarget(),
      formStepDescriptionTarget('step-1'),
    ]);
    act(() => second.configuration.onSynced?.());

    let flushing!: Promise<boolean>;
    act(() => {
      flushing = flushEditorSaves(`form:${entityId}`);
    });
    await vi.waitFor(() => expect(persistNowMock).toHaveBeenCalledOnce());
    expect(second.configuration.document.getMap<string>(FORM_FIELDS_MAP_NAME).get('title')).toBe('Local title');
    expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(true);

    acknowledgePersistence();
    await act(async () => {
      expect(await flushing).toBe(true);
    });

    const fields = second.configuration.document.getMap<string>(FORM_FIELDS_MAP_NAME);
    expect(fields.get('title')).toBe('Local title');
    expect(JSON.parse(fields.get('schema') ?? '')).toEqual(peerSchema);
    expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(false);
    expect(persistNowMock).toHaveBeenCalledOnce();
  });

  it('replays a pending target Form title without dropping its locale presence', async () => {
    await act(async () => {
      root?.render(<FormEditorHarness locale="ko" />);
      await Promise.resolve();
    });

    const first = providerState.instances[0]!;
    const schema = { id: 'schema-1', steps: [{ id: 'step-1', fields: [] }] };
    seedFormRoom(first.configuration.document, 'ko', null, schema);
    act(() => first.configuration.onSynced?.());
    await act(async () => {
      await Promise.resolve();
    });
    act(() => latestFormEditor?.setField('title', 'Local target title'));
    expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(true);

    act(() =>
      first.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );
    const second = providerState.instances[1]!;
    seedFormRoom(second.configuration.document, 'ko', null, schema, nextDocumentRevision);
    act(() => second.configuration.onSynced?.());

    await act(async () => {
      expect(await flushEditorSaves(`form:${entityId}`)).toBe(true);
    });

    expect(second.configuration.document.getMap<string>(FORM_FIELDS_MAP_NAME).get('title')).toBe('Local target title');
    expect(
      second.configuration.document.getMap<boolean>(FORM_LOCALE_PRESENCE_MAP_NAME).get('document\u0000title'),
    ).toBe(true);
    expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(false);
    expect(persistNowMock).toHaveBeenCalledOnce();
  });

  it('does not register a Form title save when a local write leaves the title unchanged', async () => {
    await act(async () => {
      root?.render(<FormEditorHarness locale="en" />);
      await Promise.resolve();
    });

    const provider = providerState.instances[0]!;
    seedFormRoom(provider.configuration.document, 'en', 'Server form', { id: 'schema-1', steps: [] });
    act(() => provider.configuration.onSynced?.());
    await act(async () => {
      await Promise.resolve();
    });
    act(() => latestFormEditor?.setField('title', 'Server form'));

    expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(false);
    expect(persistNowMock).not.toHaveBeenCalled();
  });

  it.each([
    [`menu:${entityId}:ko`, 'menu'],
    [`post-series:${entityId}:ko`, 'post_series'],
    [`email-layout:${entityId}:ko`, 'email_layout'],
  ])('automatically rebuilds the current %s editor on reload-required', async (documentName, _saveKey) => {
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });

    const first = providerState.instances[0]!;
    act(() =>
      first.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );

    const second = providerState.instances[1]!;
    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(second.configuration.name).toBe(documentName);
    expect(second.configuration.document).not.toBe(first.configuration.document);
    expect(snapshots.at(-1)?.connection.provider).toBe(second);
  });

  it('rebuilds an exact document room on an epoch mismatch', async () => {
    const documentName = `email-layout:${entityId}:ko`;
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });

    const first = providerState.instances[0]!;
    act(() =>
      first.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'epoch_mismatch' }),
      }),
    );

    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(providerState.instances[1]?.configuration.name).toBe(documentName);
    expect(providerState.instances[1]?.configuration.document).not.toBe(first.configuration.document);
  });

  it('replays a queued Menu label edit without resurrecting a peer-deleted item after canonical reload', async () => {
    const documentName = `menu:${entityId}:ko`;
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });

    const first = providerState.instances[0]!;
    const menuItem = { id: 'item-a', label: 'Source label', linkType: 'external', url: 'https://example.com' };
    seedMenuRoom(first.configuration.document, 'ko', [menuItem]);
    act(() => first.configuration.onSynced?.());
    act(() => setMenuLocaleLabel(first.configuration.document, 'item-a', 'Local label'));
    expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(true);

    act(() =>
      first.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );
    const second = providerState.instances[1]!;
    await act(async () => {
      expect(await flushEditorSaves(`menu:${entityId}`)).toBe(false);
    });
    expect(persistNowMock).not.toHaveBeenCalled();

    seedMenuRoom(second.configuration.document, 'ko', []);
    act(() => second.configuration.onSynced?.());

    await act(async () => {
      expect(await flushEditorSaves(`menu:${entityId}`)).toBe(true);
    });

    expect(second.configuration.document.getMap(MENU_ITEMS_MAP_NAME).has('item-a')).toBe(false);
    expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(false);
    expect(persistNowMock).toHaveBeenCalledOnce();
  });

  it('adopts and persists unsaved intents a closed tab of this member left for the room', async () => {
    const documentName = `menu:${entityId}:ko`;
    const menuItem = { id: 'item-a', label: 'Source label', linkType: 'external', url: 'https://example.com' };
    const scratch = new Y.Doc();
    seedMenuRoom(scratch, 'ko', [menuItem]);
    const before = captureDocumentRoomSnapshot(documentName, scratch)!;
    setMenuLocaleLabel(scratch, 'item-a', 'Adopted label');
    const after = captureDocumentRoomSnapshot(documentName, scratch)!;
    scratch.destroy();
    const claimOrphans = vi.fn(async () => ({ changes: [{ before, after }], recovery: null, records: 1 }));
    const journal = vi.spyOn(documentRoomJournalStore, 'getDocumentRoomJournalStore').mockReturnValue({
      tabId: 'tab',
      writeChanges: vi.fn(),
      writeRecovery: vi.fn(),
      claimOrphans,
      clearMember: vi.fn(),
      flush: async () => {},
      isSettled: () => true,
      prune: async () => {},
      dispose: vi.fn(),
    });
    try {
      await act(async () => {
        root?.render(<ReloadHarness documentName={documentName} />);
        await Promise.resolve();
      });
      const first = providerState.instances[0]!;
      seedMenuRoom(first.configuration.document, 'ko', [menuItem]);
      await act(async () => {
        first.configuration.onSynced?.();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(claimOrphans).toHaveBeenCalledWith({ documentName });
      // The synced room flushes adopted intents at once: replay, persist, acknowledge.
      await act(async () => {
        expect(await flushEditorSaves(`menu:${entityId}`)).toBe(true);
      });
      const persisted = captureDocumentRoomSnapshot(
        documentName,
        first.configuration.document,
      ) as MenuDocumentRoomIntentSnapshot | null;
      expect(persisted?.requestedLabels['item-a']).toBe('Adopted label');
      expect(persistNowMock).toHaveBeenCalledOnce();
      expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(false);
    } finally {
      journal.mockRestore();
    }
  });

  it('parks unsaved intents instead of sending them once the room is downgraded to view', async () => {
    const documentName = `menu:${entityId}:fr`;
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });
    const first = providerState.instances[0]!;
    const menuItem = { id: 'item-a', label: 'Source label', linkType: 'external', url: 'https://example.com' };
    seedMenuRoom(first.configuration.document, 'fr', [menuItem]);
    act(() => first.configuration.onSynced?.());
    act(() => setMenuLocaleLabel(first.configuration.document, 'item-a', 'Local label'));
    expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(true);

    act(() =>
      first.emit('stateless', { payload: JSON.stringify({ v: 3, kind: 'room.access_changed', access: 'view' }) }),
    );
    expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(false);
    await act(async () => {
      expect(await flushEditorSaves(`menu:${entityId}`)).toBe(true);
    });
    expect(persistNowMock).not.toHaveBeenCalled();
    // Kept for a room reopened with edit access.
    const journal = await import('@/lib/collab/document-room-intent-journal');
    expect(journal.hasDocumentRoomIntents(documentName, null)).toBe(true);
  });

  it('starts parked when the room admits a viewer read-only', async () => {
    const documentName = `menu:${entityId}:de`;
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });
    const first = providerState.instances[0]!;
    act(() =>
      first.emit('stateless', { payload: JSON.stringify({ v: 3, kind: 'room.access_changed', access: 'view' }) }),
    );
    const { getProviderAccessLevel } = await import('@/lib/collab/provider-control-state');
    expect(getProviderAccessLevel(first)).toBe('view');
  });

  it('saves parked intents again when a readmission reports edit access', async () => {
    const documentName = `menu:${entityId}:it`;
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });
    const first = providerState.instances[0]!;
    const menuItem = { id: 'item-a', label: 'Source label', linkType: 'external', url: 'https://example.com' };
    seedMenuRoom(first.configuration.document, 'it', [menuItem]);
    act(() => first.configuration.onSynced?.());
    act(() => setMenuLocaleLabel(first.configuration.document, 'item-a', 'Parked label'));
    const access = (level: 'view' | 'edit') =>
      act(() =>
        first.emit('stateless', { payload: JSON.stringify({ v: 3, kind: 'room.access_changed', access: level }) }),
      );
    access('view');
    expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(false);
    access('edit');
    expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(true);
    // Granted edit while open: a fresh sync re-sends what the read-only room dropped. connect()
    // before the close event would be a no-op on the still-open socket.
    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(first.connect).not.toHaveBeenCalled();
    act(() => first.emit('disconnect'));
    expect(first.connect).toHaveBeenCalledOnce();
    act(() => first.emit('disconnect'));
    expect(first.connect).toHaveBeenCalledOnce();
    await act(async () => {
      expect(await flushEditorSaves(`menu:${entityId}`)).toBe(true);
    });
    expect(persistNowMock).toHaveBeenCalledOnce();
  });

  it('reports an access change made while the provider was replaced', async () => {
    const { subscribeToProviderAccessLevel } = await import('@/lib/collab/provider-control-state');
    const changes: Array<{ access: string; provider: object; changed: boolean }> = [];
    const unsubscribe = subscribeToProviderAccessLevel((access, provider, changed) =>
      changes.push({ access, provider, changed }),
    );
    try {
      const documentName = `menu:${entityId}:es`;
      await act(async () => {
        root?.render(<ReloadHarness documentName={documentName} />);
        await Promise.resolve();
      });
      const first = providerState.instances[0]!;
      const access = (instance: typeof first, level: 'view' | 'edit') =>
        act(() =>
          instance.emit('stateless', { payload: JSON.stringify({ v: 3, kind: 'room.access_changed', access: level }) }),
        );
      access(first, 'view');
      expect(changes).toEqual([{ access: 'view', provider: first, changed: false }]);
      act(() =>
        first.emit('stateless', {
          payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
        }),
      );
      const second = providerState.instances[1]!;
      // The replacement starts at `edit`; the room's previous level makes this an upgrade.
      access(second, 'edit');
      expect(changes.at(-1)).toEqual({ access: 'edit', provider: second, changed: true });
      access(second, 'edit');
      expect(changes).toHaveLength(2);
    } finally {
      unsubscribe();
    }
  });

  it.each(['permission_revoked', 'session_expired'] as const)(
    'ends access and drops a pending readmission when a readmission is refused: %s',
    async (reason) => {
      const documentName = `menu:${entityId}:pt`;
      await act(async () => {
        root?.render(<ReloadHarness documentName={documentName} />);
        await Promise.resolve();
      });
      const first = providerState.instances[0]!;
      act(() => first.configuration.onSynced?.());
      const access = (level: 'view' | 'edit') =>
        act(() =>
          first.emit('stateless', { payload: JSON.stringify({ v: 3, kind: 'room.access_changed', access: level }) }),
        );
      access('view');
      access('edit');
      act(() => first.configuration.onAuthenticationFailed?.({ reason }));
      act(() => first.emit('disconnect'));
      expect(first.connect).not.toHaveBeenCalled();
      const { getProviderAccessEnded } = await import('@/lib/collab/provider-control-state');
      expect(getProviderAccessEnded(first)).toBe(reason);
    },
  );

  it('does not reconnect a provider waiting for a deferred canonical reload', async () => {
    const documentName = `map-theme:${entityId}:und`;
    const onReloadRequired = vi.fn();
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} onReloadRequired={onReloadRequired} />);
      await Promise.resolve();
    });
    const first = providerState.instances[0]!;
    act(() =>
      first.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );
    expect(onReloadRequired).toHaveBeenCalledOnce();
    act(() => window.dispatchEvent(new Event('online')));
    expect(first.connect).not.toHaveBeenCalled();
  });

  it.each(['service_stopping', 'authorization_unavailable'])(
    'keeps the room and retries a temporarily refused admission: %s',
    async (reason) => {
      vi.useFakeTimers();
      try {
        const documentName = `menu:${entityId}:nl`;
        await act(async () => {
          root?.render(<ReloadHarness documentName={documentName} />);
          await Promise.resolve();
        });
        const first = providerState.instances[0]!;
        act(() => first.configuration.onAuthenticationFailed?.({ reason }));
        const { getProviderAccessEnded } = await import('@/lib/collab/provider-control-state');
        expect(getProviderAccessEnded(first)).toBeUndefined();
        expect(first.disconnect).not.toHaveBeenCalled();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1_000);
        });
        // The retry reopens the socket so the room authenticates again.
        expect(first.disconnect).toHaveBeenCalledOnce();
        act(() => first.emit('disconnect'));
        expect(first.connect).toHaveBeenCalledOnce();
        expect(providerState.instances).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('does not journal local authoring changes before the first provider sync', async () => {
    const documentName = `menu:${entityId}:ko`;
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });

    const provider = providerState.instances[0]!;
    seedMenuRoom(provider.configuration.document, 'ko', [
      { id: 'item-a', label: 'Source label', linkType: 'external', url: 'https://example.com' },
    ]);
    act(() => setMenuLocaleLabel(provider.configuration.document, 'item-a', 'Before first sync'));
    act(() => provider.configuration.onSynced?.());

    expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(false);
    expect(persistNowMock).not.toHaveBeenCalled();
  });

  it('keeps edits recorded during a persistence ACK queued for a second write', async () => {
    const documentName = `menu:${entityId}:ko`;
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });

    const provider = providerState.instances[0]!;
    const document = provider.configuration.document;
    const item = { id: 'item-a', label: 'Source label', linkType: 'external', url: 'https://example.com' };
    seedMenuRoom(document, 'ko', [item]);
    act(() => provider.configuration.onSynced?.());
    act(() => setMenuLocaleLabel(document, 'item-a', 'First local edit'));

    let acknowledgeFirst!: () => void;
    persistNowMock.mockImplementationOnce(() => new Promise<void>((resolve) => (acknowledgeFirst = resolve)));
    let flushPromise!: Promise<boolean>;
    act(() => {
      flushPromise = flushEditorSaves(`menu:${entityId}`);
    });
    await vi.waitFor(() => expect(persistNowMock).toHaveBeenCalledOnce());

    act(() => setMenuLocaleLabel(document, 'item-a', 'Second local edit'));
    acknowledgeFirst();
    await act(async () => {
      expect(await flushPromise).toBe(true);
    });

    expect(persistNowMock).toHaveBeenCalledTimes(2);
    expect(hasPendingEditorSaves(`menu:${entityId}`)).toBe(false);
    expect(document.getMap<string>(MENU_ITEMS_MAP_NAME).has('item-a')).toBe(true);
  });

  it('does not reload another document domain and keeps auth failures terminal', async () => {
    const onReloadRequired = vi.fn();

    await act(async () => {
      root?.render(<ReloadHarness documentName={`post:${entityId}:en`} onReloadRequired={onReloadRequired} />);
      await Promise.resolve();
    });
    const nonTheme = providerState.instances[0]!;
    act(() =>
      nonTheme.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      }),
    );
    expect(onReloadRequired).not.toHaveBeenCalled();
    expect(nonTheme.disconnect).not.toHaveBeenCalled();
    expect(snapshots.at(-1)?.connection.reloadCanonical()).toBe(false);

    await act(async () => {
      root?.render(<ReloadHarness documentName={`map-theme:${entityId}:ko`} onReloadRequired={onReloadRequired} />);
      await Promise.resolve();
    });
    expect(snapshots.at(-1)?.connection.reloadCanonical()).toBe(false);
    expect(providerState.instances).toHaveLength(1);

    await act(async () => {
      root?.render(<ReloadHarness documentName={`map-theme:${entityId}:und`} onReloadRequired={onReloadRequired} />);
      await Promise.resolve();
    });
    const themeProvider = providerState.instances.at(-1)!;
    act(() => {
      themeProvider.configuration.onAuthenticationFailed?.({ reason: 'permission_denied' });
      themeProvider.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
      });
    });

    expect(onReloadRequired).not.toHaveBeenCalled();
    expect(providerState.instances).toHaveLength(2);
  });
});

it('clears document-room semantic intents only on covering room.persisted for the active room', async () => {
  await act(async () => {
    root?.render(<FormEditorHarness locale="en" />);
    await Promise.resolve();
  });
  const resident = providerState.instances[0]!;
  seedFormRoom(resident.configuration.document, 'en', 'Server form', { id: 'schema-1', steps: [] });
  act(() => resident.configuration.onSynced?.());
  act(() => latestFormEditor?.setField('title', 'Local form'));
  expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(true);
  const document = resident.configuration.document;
  const send = (stateVector: string) =>
    resident.emit('stateless', {
      payload: JSON.stringify({
        v: 3,
        kind: 'room.persisted',
        documentName: resident.configuration.name,
        stateVector,
        deleted: Object.fromEntries(Y.decodeUpdate(Y.encodeStateAsUpdate(document)).ds.clients),
      }),
    });
  act(() => send('AA=='));
  expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(true);
  act(() => send(Buffer.from(Y.encodeStateVector(document)).toString('base64')));
  expect(hasPendingEditorSaves(`form:${entityId}`)).toBe(false);
  expect(persistNowMock).not.toHaveBeenCalled();
});
