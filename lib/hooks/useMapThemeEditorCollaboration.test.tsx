// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  createMapThemeMetaMap,
  createMapThemeSettingsMap,
  createMapThemeVariantMap,
} from '@/lib/collab/map-theme-fields';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
import { useMapThemeEditorCollaboration } from './useMapThemeEditorCollaboration';

const { persistCollaborativeDocumentNow } = vi.hoisted(() => ({
  persistCollaborativeDocumentNow: vi.fn<() => Promise<void>>(),
}));

vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow }));

const AUTOMATIC_PERSIST_DEBOUNCE_MS = 2_000;

const connection = vi.hoisted(() => ({
  doc: null as Y.Doc | null,
  provider: null as MockProvider | null,
  synced: false,
  onSynced: null as null | ((doc: Y.Doc) => void),
  onReloadRequired: null as null | ((reloadCanonical: () => boolean) => void),
  documentName: null as string | null,
}));

interface MockProvider {
  document: Y.Doc;
  hasUnsyncedChanges: boolean;
  readonly isSynced: boolean;
  on: (event: string, listener: (event: { number: number } | { state: boolean }) => void) => void;
  off: (event: string, listener: (event: { number: number } | { state: boolean }) => void) => void;
  emitUnsyncedChanges: (number: number) => void;
  emitSynced: (state: boolean) => void;
}

vi.mock('./useHocuspocusConnection', () => ({
  useHocuspocusConnection: (options: {
    documentName: string;
    onSynced?: (doc: Y.Doc) => void;
    onReloadRequired?: (reloadCanonical: () => boolean) => void;
  }) => {
    connection.documentName = options.documentName;
    connection.onSynced = options.onSynced ?? null;
    connection.onReloadRequired = options.onReloadRequired ?? null;
    return {
      provider: connection.provider,
      doc: connection.doc,
      isConnected: connection.synced,
      isSynced: connection.synced,
      reloadCanonical: () => true,
    };
  },
}));

const documents: Y.Doc[] = [];
const renderedSyncStates: boolean[] = [];
let container: HTMLDivElement;
let root: Root;

function createThemeDocument(snapshot?: {
  name?: string;
  settings?: Partial<typeof DEFAULT_THEME_SETTINGS>;
  lightVariant?: Partial<Omit<typeof DEFAULT_LIGHT_VARIANT, 'scheme'>>;
  darkVariant?: Partial<Omit<typeof DEFAULT_DARK_VARIANT, 'scheme'>>;
}) {
  const doc = new Y.Doc();
  documents.push(doc);
  createMapThemeMetaMap(doc).setMany({ name: snapshot?.name ?? 'Canonical theme' });
  createMapThemeSettingsMap(doc).setMany({ ...DEFAULT_THEME_SETTINGS, ...snapshot?.settings });
  createMapThemeVariantMap(doc, 'light').setMany({
    ...withoutScheme(DEFAULT_LIGHT_VARIANT),
    ...snapshot?.lightVariant,
  });
  createMapThemeVariantMap(doc, 'dark').setMany({
    ...withoutScheme(DEFAULT_DARK_VARIANT),
    ...snapshot?.darkVariant,
  });
  return doc;
}

function setConnectionDocument(doc: Y.Doc) {
  connection.doc = doc;
  const listeners = new Map<string, Set<(event: { number: number } | { state: boolean }) => void>>();
  const provider: MockProvider = {
    document: doc,
    hasUnsyncedChanges: false,
    get isSynced() {
      return connection.synced;
    },
    on: (event, listener) => {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    },
    off: (event, listener) => {
      listeners.get(event)?.delete(listener);
    },
    emitUnsyncedChanges: (number) => {
      provider.hasUnsyncedChanges = number > 0;
      listeners.get('unsyncedChanges')?.forEach((listener) => listener({ number }));
    },
    emitSynced: (state) => {
      connection.synced = state;
      listeners.get('synced')?.forEach((listener) => listener({ state }));
    },
  };
  connection.provider = provider;
}

function withoutScheme<T extends { scheme: string }>({ scheme: _scheme, ...variant }: T) {
  return variant;
}

function Probe({ themeId = '11111111-1111-4111-8111-111111111111' }: { themeId?: string }) {
  result.current = useMapThemeEditorCollaboration(themeId, initialState);
  renderedSyncStates.push(result.current.isSynced);
  return null;
}

const initialState = {
  name: 'Stale GET name',
  settings: DEFAULT_THEME_SETTINGS,
  lightVariant: DEFAULT_LIGHT_VARIANT,
  darkVariant: DEFAULT_DARK_VARIANT,
};
const result: { current: ReturnType<typeof useMapThemeEditorCollaboration> | null } = { current: null };

function renderProbe() {
  act(() => root.render(<Probe />));
}

function syncCurrentDocument() {
  connection.synced = true;
  renderProbe();
  act(() => connection.onSynced?.(connection.doc!));
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settlePromiseCallbacks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceAutomaticPersistDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOMATIC_PERSIST_DEBOUNCE_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  persistCollaborativeDocumentNow.mockReset().mockResolvedValue(undefined);
  setConnectionDocument(createThemeDocument());
  connection.synced = false;
  connection.onSynced = null;
  connection.onReloadRequired = null;
  connection.documentName = null;
  result.current = null;
  renderedSyncStates.length = 0;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  documents.splice(0).forEach((doc) => doc.destroy());
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useMapThemeEditorCollaboration', () => {
  it('never seeds a Y.Map from stale manage GET state and enables mutations only after server sync', () => {
    const doc = connection.doc!;
    const meta = createMapThemeMetaMap(doc);

    renderProbe();

    expect(result.current?.name).toBe('Stale GET name');
    expect(connection.documentName).toBe('map-theme:11111111-1111-4111-8111-111111111111:und');
    expect(meta.getAll()).toEqual({ name: 'Canonical theme' });
    expect(createMapThemeSettingsMap(doc).getAll()).toEqual(DEFAULT_THEME_SETTINGS);

    act(() => result.current?.setName('Must not write before sync'));
    expect(meta.get('name')).toBe('Canonical theme');

    syncCurrentDocument();

    expect(result.current?.isSynced).toBe(true);
    expect(result.current?.name).toBe('Canonical theme');
    act(() => result.current?.setName('Accepted synced edit'));
    expect(meta.get('name')).toBe('Accepted synced edit');
  });

  it('replays only locally changed keys over a fresh canonical document and preserves remote untouched keys', () => {
    setConnectionDocument(
      createThemeDocument({
        name: 'Baseline name',
        settings: { calloutScale: 1, calloutFields: ['name', 'address'], showPoiLabels: false },
        lightVariant: { backgroundColor: '#eeeeee', waterColor: '#a0c4e8' },
        darkVariant: { clusterColor: 'rgba(248,250,252,0.08)' },
      }),
    );
    renderProbe();
    syncCurrentDocument();

    act(() => {
      result.current?.updateSettings({ calloutScale: 1.35, calloutFields: ['name', 'coordinates'] });
      result.current?.updateLightVariant({ backgroundColor: '#123456' });
    });
    expect(createMapThemeSettingsMap(connection.doc!).getAll()).toMatchObject({
      calloutScale: 1.35,
      calloutFields: ['name', 'coordinates'],
    });
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(true);
    act(() => connection.onReloadRequired?.(() => true));

    const freshDocument = createThemeDocument({
      name: 'Remote name',
      settings: { calloutScale: 1, calloutFields: ['name', 'address'], showPoiLabels: true },
      lightVariant: { backgroundColor: '#eeeeee', waterColor: '#0f766e' },
      darkVariant: { clusterColor: '#112233' },
    });
    setConnectionDocument(freshDocument);
    connection.synced = false;
    renderProbe();
    renderedSyncStates.length = 0;
    connection.synced = true;
    renderProbe();
    expect(renderedSyncStates[0]).toBe(false);
    act(() => connection.onSynced?.(freshDocument));
    expect(result.current?.isSynced).toBe(true);

    const settings = createMapThemeSettingsMap(freshDocument).getAll();
    const lightVariant = createMapThemeVariantMap(freshDocument, 'light').getAll();
    const darkVariant = createMapThemeVariantMap(freshDocument, 'dark').getAll();
    expect(settings).toMatchObject({
      calloutScale: 1.35,
      calloutFields: ['name', 'coordinates'],
      showPoiLabels: true,
    });
    expect(lightVariant).toMatchObject({ backgroundColor: '#123456', waterColor: '#0f766e' });
    expect(darkVariant.clusterColor).toBe('#112233');
    expect(result.current?.name).toBe('Remote name');
  });

  it('retries a staged same-key value after canonical sync so its later server commit wins', () => {
    setConnectionDocument(createThemeDocument({ settings: { calloutFields: ['name', 'address'] } }));
    renderProbe();
    syncCurrentDocument();

    act(() => result.current?.updateSettings({ calloutFields: ['name', 'coordinates'] }));
    act(() => connection.onReloadRequired?.(() => true));

    const freshDocument = createThemeDocument({ settings: { calloutFields: ['name', 'city'] } });
    setConnectionDocument(freshDocument);
    connection.synced = false;
    renderProbe();
    syncCurrentDocument();

    expect(createMapThemeSettingsMap(freshDocument).get('calloutFields')).toEqual(['name', 'coordinates']);
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(true);
  });

  it('does not replay an edit already acknowledged by the server over a later peer value', async () => {
    const initialDocument = createThemeDocument({ name: 'Baseline theme' });
    setConnectionDocument(initialDocument);
    renderProbe();
    syncCurrentDocument();

    act(() => result.current?.setName('Acknowledged local theme'));
    act(() => {
      connection.provider?.emitUnsyncedChanges(1);
      connection.provider?.emitUnsyncedChanges(0);
    });
    await advanceAutomaticPersistDebounce();
    await settlePromiseCallbacks();
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(false);
    act(() => connection.onReloadRequired?.(() => true));

    const freshDocument = createThemeDocument({ name: 'Later peer theme' });
    setConnectionDocument(freshDocument);
    connection.synced = false;
    renderProbe();
    syncCurrentDocument();

    expect(createMapThemeMetaMap(freshDocument).get('name')).toBe('Later peer theme');
  });

  it('keeps field intent through transport sync until persist.now acknowledges the write', async () => {
    setConnectionDocument(createThemeDocument({ name: 'Initial name' }));
    renderProbe();
    syncCurrentDocument();

    const firstPersist = createDeferred<void>();
    persistCollaborativeDocumentNow.mockReturnValueOnce(firstPersist.promise);
    act(() => result.current?.setName('Local name'));
    act(() => {
      connection.provider?.emitUnsyncedChanges(1);
      connection.provider?.emitUnsyncedChanges(0);
    });
    expect(persistCollaborativeDocumentNow).not.toHaveBeenCalled();
    await advanceAutomaticPersistDebounce();
    expect(persistCollaborativeDocumentNow).toHaveBeenCalledOnce();
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(true);

    act(() => connection.onReloadRequired?.(() => true));
    const freshDocument = createThemeDocument({ name: 'Peer name' });
    setConnectionDocument(freshDocument);
    connection.synced = false;
    renderProbe();
    syncCurrentDocument();

    expect(createMapThemeMetaMap(freshDocument).get('name')).toBe('Local name');
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(true);
    firstPersist.resolve(undefined);
    await settlePromiseCallbacks();
  });

  it('advances the field baseline after persist.now ACK and keeps later edits pending through their own ACK', async () => {
    setConnectionDocument(createThemeDocument({ name: 'Initial name' }));
    renderProbe();
    syncCurrentDocument();

    const firstPersist = createDeferred<void>();
    persistCollaborativeDocumentNow.mockReturnValueOnce(firstPersist.promise);
    act(() => result.current?.setName('Saved local name'));
    act(() => {
      connection.provider?.emitUnsyncedChanges(1);
      connection.provider?.emitUnsyncedChanges(0);
    });
    await advanceAutomaticPersistDebounce();
    expect(persistCollaborativeDocumentNow).toHaveBeenCalledOnce();
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(true);

    firstPersist.resolve(undefined);
    await settlePromiseCallbacks();
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(false);

    const secondPersist = createDeferred<void>();
    persistCollaborativeDocumentNow.mockReturnValueOnce(secondPersist.promise);
    act(() => result.current?.setName('Newer local name'));
    act(() => {
      connection.provider?.emitUnsyncedChanges(1);
      connection.provider?.emitUnsyncedChanges(0);
    });
    await advanceAutomaticPersistDebounce();
    expect(persistCollaborativeDocumentNow).toHaveBeenCalledTimes(2);
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(true);

    secondPersist.resolve(undefined);
    await settlePromiseCallbacks();
    expect(hasPendingEditorSaves('map_theme:11111111-1111-4111-8111-111111111111')).toBe(false);

    act(() => connection.onReloadRequired?.(() => true));
    const freshDocument = createThemeDocument({ name: 'Later peer name' });
    setConnectionDocument(freshDocument);
    connection.synced = false;
    renderProbe();
    syncCurrentDocument();

    expect(createMapThemeMetaMap(freshDocument).get('name')).toBe('Later peer name');
  });

  it('resets the collaboration baseline and staged intents when the theme identity changes', () => {
    setConnectionDocument(createThemeDocument({ name: 'First theme' }));
    act(() => root.render(<Probe themeId="11111111-1111-4111-8111-111111111111" />));
    syncCurrentDocument();
    act(() => result.current?.setName('Unsaved first theme edit'));
    act(() => connection.onReloadRequired?.(() => true));

    setConnectionDocument(createThemeDocument({ name: 'Canonical second theme' }));
    connection.synced = false;
    act(() => root.render(<Probe themeId="22222222-2222-4222-8222-222222222222" />));
    expect(connection.documentName).toBe('map-theme:22222222-2222-4222-8222-222222222222:und');
    expect(result.current?.name).toBe('Stale GET name');
    connection.synced = true;
    act(() => root.render(<Probe themeId="22222222-2222-4222-8222-222222222222" />));
    act(() => connection.onSynced?.(connection.doc!));
    expect(result.current?.name).toBe('Canonical second theme');
  });
});
