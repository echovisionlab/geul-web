// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  createMapThemeMetaMap,
  createMapThemeSettingsMap,
  createMapThemeVariantMap,
} from '@/lib/collab/map-theme-fields';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { useMapThemeEditorCollaboration } from './useMapThemeEditorCollaboration';

const connection = vi.hoisted(() => ({
  doc: null as Y.Doc | null,
  synced: false,
  onSynced: null as null | ((doc: Y.Doc) => void),
  documentName: null as string | null,
}));

vi.mock('./useHocuspocusConnection', () => ({
  useHocuspocusConnection: (options: { documentName: string; onSynced?: (doc: Y.Doc) => void }) => {
    connection.documentName = options.documentName;
    connection.onSynced = options.onSynced ?? null;
    return {
      provider: null,
      doc: connection.doc,
      isConnected: connection.synced,
      isSynced: connection.synced,
    };
  },
}));

function withoutScheme<T extends { scheme: string }>({ scheme: _scheme, ...variant }: T) {
  return variant;
}

describe('useMapThemeEditorCollaboration', () => {
  beforeEach(() => {
    connection.doc = new Y.Doc();
    connection.synced = false;
    connection.onSynced = null;
    connection.documentName = null;
  });

  it('never seeds a Y.Map from stale manage GET state and enables mutations only after server sync', () => {
    const staleInitialState = {
      name: 'Stale GET name',
      settings: DEFAULT_THEME_SETTINGS,
      lightVariant: DEFAULT_LIGHT_VARIANT,
      darkVariant: DEFAULT_DARK_VARIANT,
    };
    const container = document.createElement('div');
    const root = createRoot(container);
    const result: { current: ReturnType<typeof useMapThemeEditorCollaboration> | null } = {
      current: null,
    };

    function Probe() {
      result.current = useMapThemeEditorCollaboration('11111111-1111-4111-8111-111111111111', staleInitialState);
      return null;
    }

    act(() => root.render(<Probe />));
    const doc = connection.doc!;
    const meta = createMapThemeMetaMap(doc);

    expect(result.current?.name).toBe('Stale GET name');
    expect(connection.documentName).toBe('map-theme:11111111-1111-4111-8111-111111111111:und');
    expect(meta.getAll()).toEqual({});

    act(() => result.current?.setName('Must not write before sync'));
    expect(meta.getAll()).toEqual({});

    meta.setMany({ name: 'Newest collaboration snapshot' });
    createMapThemeSettingsMap(doc).setMany(DEFAULT_THEME_SETTINGS);
    createMapThemeVariantMap(doc, 'light').setMany(withoutScheme(DEFAULT_LIGHT_VARIANT));
    createMapThemeVariantMap(doc, 'dark').setMany(withoutScheme(DEFAULT_DARK_VARIANT));

    connection.synced = true;
    act(() => root.render(<Probe />));
    act(() => connection.onSynced?.(doc));

    expect(result.current?.isSynced).toBe(true);
    expect(result.current?.name).toBe('Newest collaboration snapshot');

    act(() => result.current?.setName('Accepted synced edit'));
    expect(meta.get('name')).toBe('Accepted synced edit');

    act(() => result.current?.setName('   '));
    act(() => result.current?.setName('x'.repeat(256)));
    expect(meta.get('name')).toBe('Accepted synced edit');
    expect(result.current?.isSynced).toBe(true);

    act(() => result.current?.setName('New '));
    expect(meta.get('name')).toBe('New ');
    expect(result.current?.name).toBe('New ');
    act(() => result.current?.setName('New Theme'));
    expect(meta.get('name')).toBe('New Theme');

    act(() => result.current?.setName('🎧'.repeat(255)));
    expect(meta.get('name')).toBe('🎧'.repeat(255));
    act(() => result.current?.setName('🎧'.repeat(256)));
    expect(meta.get('name')).toBe('🎧'.repeat(255));
    expect(result.current?.isSynced).toBe(true);
    act(() => root.unmount());
  });
});
