// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import {
  hydrateMenuCanonicalRoom,
  MENU_ITEMS_MAP_NAME,
  setMenuLocaleLabel,
  type MenuCollaborationItem,
} from '@echovisionlab/geul-common/collaboration/menu';
import { DOCUMENT_ROOM_SNAPSHOT_KEYS, DOCUMENT_ROOM_SNAPSHOT_MAP_NAME } from '@/lib/collab/document-room-snapshot';
import { flushEditorSaves, hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
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
const snapshots: Array<{ name: string; connection: ReturnType<typeof useHocuspocusConnection> }> = [];
let root: Root | null = null;
let container: HTMLDivElement | null = null;

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

beforeEach(() => {
  providerState.instances.length = 0;
  snapshots.length = 0;
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
      first.emit('stateless', { payload: JSON.stringify({ kind: 'reload_required' }) });
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
      first.emit('stateless', { payload: JSON.stringify({ kind: 'reload_required' }) });
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
    act(() => first.emit('stateless', { payload: JSON.stringify({ kind: 'reload_required' }) }));

    const second = providerState.instances[1]!;
    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(providerState.instances).toHaveLength(2);
    expect(second.configuration.name).toBe(documentName);
    expect(second.configuration.document).not.toBe(first.configuration.document);
    expect(snapshots.at(-1)?.connection.provider).toBe(second);
  });

  it('rebuilds an exact document room when authentication reports reload_required', async () => {
    const documentName = `email-layout:${entityId}:ko`;
    await act(async () => {
      root?.render(<ReloadHarness documentName={documentName} />);
      await Promise.resolve();
    });

    const first = providerState.instances[0]!;
    act(() => first.configuration.onAuthenticationFailed?.({ reason: 'reload_required' }));

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

    act(() => first.emit('stateless', { payload: JSON.stringify({ kind: 'reload_required' }) }));
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
    act(() => nonTheme.emit('stateless', { payload: JSON.stringify({ kind: 'reload_required' }) }));
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
      themeProvider.emit('stateless', { payload: JSON.stringify({ kind: 'reload_required' }) });
    });

    expect(onReloadRequired).not.toHaveBeenCalled();
    expect(providerState.instances).toHaveLength(2);
  });
});
