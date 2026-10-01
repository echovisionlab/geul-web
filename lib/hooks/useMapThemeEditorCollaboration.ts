'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import {
  createMapThemeMetaMap,
  createMapThemeSettingsMap,
  createMapThemeVariantMap,
  MapThemeDocumentMetaSchema,
  MapThemeDocumentSettingsSchema,
  MapThemeDocumentVariantSchema,
  type MapThemeDocumentSettings,
  type MapThemeDocumentVariant,
} from '@/lib/collab/map-theme-fields';
import { TypedMetaMap } from '@/lib/collab/TypedMetaMap';
import type * as Y from 'yjs';
import type { ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { useMapThemeReloadRequired } from '@/features/admin/MapThemeEditor/useMapThemeReloadRequired';
import { registerCollaborativeDocumentSave } from '@/lib/editor/collaborative-document-save';
import { hasPendingEditorSaves, subscribeToEditorSaveState } from '@/lib/editor/editor-save-registry';
import { useHocuspocusConnection } from './useHocuspocusConnection';

interface MapThemeCanonicalSnapshot {
  name: string;
  settings: MapThemeDocumentSettings;
  lightVariant: MapThemeDocumentVariant;
  darkVariant: MapThemeDocumentVariant;
}

interface MapThemeFieldIntents {
  name?: string;
  settings: Partial<MapThemeDocumentSettings>;
  lightVariant: Partial<MapThemeDocumentVariant>;
  darkVariant: Partial<MapThemeDocumentVariant>;
}

interface PendingMapThemeReplay {
  intents: MapThemeFieldIntents;
}

export interface MapThemeEditorInitialState {
  name: string;
  settings: ThemeSettings;
  lightVariant: Omit<ThemeVariant, 'id'>;
  darkVariant: Omit<ThemeVariant, 'id'>;
}

export interface MapThemeEditorCollaborationResult {
  provider: ReturnType<typeof useHocuspocusConnection>['provider'];
  doc: ReturnType<typeof useHocuspocusConnection>['doc'];
  isConnected: boolean;
  isSynced: boolean;
  name: string;
  settings: ThemeSettings;
  lightVariant: Omit<ThemeVariant, 'id'>;
  darkVariant: Omit<ThemeVariant, 'id'>;
  setName: (value: string) => void;
  updateSettings: (values: Partial<MapThemeDocumentSettings>) => void;
  updateLightVariant: (values: Partial<MapThemeDocumentVariant>) => void;
  updateDarkVariant: (values: Partial<MapThemeDocumentVariant>) => void;
}

export function useMapThemeEditorCollaboration(
  themeId: string,
  initialState?: MapThemeEditorInitialState,
): MapThemeEditorCollaborationResult {
  const [name, setNameState] = useState(initialState?.name ?? '');
  const [settings, setSettingsState] = useState<ThemeSettings>(initialState?.settings ?? DEFAULT_THEME_SETTINGS);
  const [lightVariant, setLightVariantState] = useState<Omit<ThemeVariant, 'id'>>(
    initialState?.lightVariant ?? DEFAULT_LIGHT_VARIANT,
  );
  const [darkVariant, setDarkVariantState] = useState<Omit<ThemeVariant, 'id'>>(
    initialState?.darkVariant ?? DEFAULT_DARK_VARIANT,
  );
  const [isDocumentReady, setIsDocumentReady] = useState(false);

  const cleanedUpRef = useRef(false);
  const hasCanonicalSyncRef = useRef(false);
  const lastSyncedDocRef = useRef<Y.Doc | null>(null);
  const canonicalSnapshotRef = useRef<MapThemeCanonicalSnapshot | null>(null);
  const fieldIntentsRef = useRef<MapThemeFieldIntents>(createEmptyFieldIntents());
  const pendingReplayRef = useRef<PendingMapThemeReplay | null>(null);
  const metaMapRef = useRef<TypedMetaMap<typeof MapThemeDocumentMetaSchema> | null>(null);
  const settingsMapRef = useRef<TypedMetaMap<typeof MapThemeDocumentSettingsSchema> | null>(null);
  const lightVariantMapRef = useRef<TypedMetaMap<typeof MapThemeDocumentVariantSchema> | null>(null);
  const darkVariantMapRef = useRef<TypedMetaMap<typeof MapThemeDocumentVariantSchema> | null>(null);
  const latestInitialStateRef = useRef(initialState);
  latestInitialStateRef.current = initialState;

  const readSnapshotFromMaps = useCallback((): MapThemeCanonicalSnapshot | null => {
    if (!metaMapRef.current || !settingsMapRef.current || !lightVariantMapRef.current || !darkVariantMapRef.current) {
      return null;
    }

    const metaResult = MapThemeDocumentMetaSchema.safeParse(metaMapRef.current.getAll());
    const settingsResult = MapThemeDocumentSettingsSchema.safeParse(settingsMapRef.current.getAll());
    const lightResult = MapThemeDocumentVariantSchema.safeParse(lightVariantMapRef.current.getAll());
    const darkResult = MapThemeDocumentVariantSchema.safeParse(darkVariantMapRef.current.getAll());
    if (!metaResult.success || !settingsResult.success || !lightResult.success || !darkResult.success) {
      setIsDocumentReady(false);
      return null;
    }

    return {
      name: metaResult.data.name,
      settings: settingsResult.data,
      lightVariant: lightResult.data,
      darkVariant: darkResult.data,
    };
  }, []);

  const syncFromMaps = useCallback(() => {
    const snapshot = readSnapshotFromMaps();
    if (!snapshot) {
      return;
    }

    setNameState(snapshot.name);
    setSettingsState(snapshot.settings);
    setLightVariantState(fromDocumentVariant('light', snapshot.lightVariant));
    setDarkVariantState(fromDocumentVariant('dark', snapshot.darkVariant));
    setIsDocumentReady(true);
  }, [readSnapshotFromMaps]);

  const stagePendingIntents = useCallback(() => {
    const baseline = canonicalSnapshotRef.current;
    if (!baseline) {
      pendingReplayRef.current = null;
      return;
    }
    pendingReplayRef.current = {
      intents: cloneFieldIntents(fieldIntentsRef.current),
    };
  }, []);
  const onReloadRequired = useMapThemeReloadRequired(stagePendingIntents);

  const {
    provider,
    doc,
    isConnected,
    isSynced: providerSynced,
  } = useHocuspocusConnection({
    documentName: createDocumentName(CollaborativeDocumentType.MAP_THEME, themeId, 'und'),
    onSynced: () => {
      if (!cleanedUpRef.current) {
        syncFromMaps();
      }
    },
    onReloadRequired,
  });
  const saveKey = `map_theme:${themeId}`;

  // This standalone document-room editor owns its save barrier here.
  useEffect(() => {
    if (!provider) {
      return;
    }
    return registerCollaborativeDocumentSave(provider, saveKey);
  }, [provider, saveKey]);

  const advanceCanonicalSnapshotIfDurable = useCallback(() => {
    if (
      !provider ||
      !provider.isSynced ||
      provider.hasUnsyncedChanges ||
      !hasCanonicalSyncRef.current ||
      pendingReplayRef.current ||
      hasPendingEditorSaves(saveKey)
    ) {
      return;
    }

    const snapshot = readSnapshotFromMaps();
    if (!snapshot) {
      return;
    }

    canonicalSnapshotRef.current = cloneCanonicalSnapshot(snapshot);
    fieldIntentsRef.current = createEmptyFieldIntents();
  }, [provider, readSnapshotFromMaps, saveKey]);

  useEffect(() => {
    if (!provider) {
      return;
    }
    const handleUnsyncedChanges = ({ number }: { number: number }) => {
      if (number === 0) {
        advanceCanonicalSnapshotIfDurable();
      }
    };
    const handleSynced = ({ state }: { state: boolean }) => {
      if (state) {
        advanceCanonicalSnapshotIfDurable();
      }
    };
    const unsubscribeSaveState = subscribeToEditorSaveState(saveKey, advanceCanonicalSnapshotIfDurable);
    provider.on('unsyncedChanges', handleUnsyncedChanges);
    provider.on('synced', handleSynced);
    advanceCanonicalSnapshotIfDurable();
    return () => {
      provider.off('unsyncedChanges', handleUnsyncedChanges);
      provider.off('synced', handleSynced);
      unsubscribeSaveState();
    };
  }, [advanceCanonicalSnapshotIfDurable, provider, saveKey]);

  const metaMap = useMemo(() => (doc ? createMapThemeMetaMap(doc) : null), [doc]);
  const settingsMap = useMemo(() => (doc ? createMapThemeSettingsMap(doc) : null), [doc]);
  const lightVariantMap = useMemo(() => (doc ? createMapThemeVariantMap(doc, 'light') : null), [doc]);
  const darkVariantMap = useMemo(() => (doc ? createMapThemeVariantMap(doc, 'dark') : null), [doc]);

  useEffect(() => {
    metaMapRef.current = metaMap;
    settingsMapRef.current = settingsMap;
    lightVariantMapRef.current = lightVariantMap;
    darkVariantMapRef.current = darkVariantMap;
  }, [metaMap, settingsMap, lightVariantMap, darkVariantMap]);

  useEffect(() => {
    if (!providerSynced || !doc || lastSyncedDocRef.current === doc) {
      return;
    }

    const canonicalSnapshot = readSnapshotFromMaps();
    if (!canonicalSnapshot) {
      return;
    }

    lastSyncedDocRef.current = doc;
    hasCanonicalSyncRef.current = true;
    canonicalSnapshotRef.current = cloneCanonicalSnapshot(canonicalSnapshot);

    const pendingReplay = pendingReplayRef.current;
    if (pendingReplay) {
      // Staged values are local commits. Apply them after the fresh server sync
      // so this editor's pending writes remain the later same-key commit.
      const replayableIntents = onlyChangedFields(pendingReplay.intents, canonicalSnapshot);
      fieldIntentsRef.current = cloneFieldIntents(replayableIntents);
      if (
        applyFieldIntents(
          doc,
          replayableIntents,
          metaMapRef.current,
          settingsMapRef.current,
          lightVariantMapRef.current,
          darkVariantMapRef.current,
        )
      ) {
        pendingReplayRef.current = null;
      }
    }
    syncFromMaps();
  }, [darkVariantMap, doc, lightVariantMap, metaMap, providerSynced, readSnapshotFromMaps, settingsMap, syncFromMaps]);

  useEffect(() => {
    cleanedUpRef.current = false;
    hasCanonicalSyncRef.current = false;
    lastSyncedDocRef.current = null;
    canonicalSnapshotRef.current = null;
    fieldIntentsRef.current = createEmptyFieldIntents();
    pendingReplayRef.current = null;
    setIsDocumentReady(false);
    const nextInitialState = latestInitialStateRef.current;
    setNameState(nextInitialState?.name ?? '');
    setSettingsState(nextInitialState?.settings ?? DEFAULT_THEME_SETTINGS);
    setLightVariantState(nextInitialState?.lightVariant ?? DEFAULT_LIGHT_VARIANT);
    setDarkVariantState(nextInitialState?.darkVariant ?? DEFAULT_DARK_VARIANT);
    return () => {
      cleanedUpRef.current = true;
    };
  }, [themeId]);

  useEffect(() => {
    if (!initialState || providerSynced || hasCanonicalSyncRef.current) {
      return;
    }

    // Manage GET is display-only. The collaboration load is the only authority allowed to seed Y.Map.
    setNameState(initialState.name);
    setSettingsState(initialState.settings);
    setLightVariantState(initialState.lightVariant);
    setDarkVariantState(initialState.darkVariant);
  }, [initialState, providerSynced]);

  useEffect(() => {
    if (!metaMap || !settingsMap || !lightVariantMap || !darkVariantMap) {
      return;
    }

    const unsubs = [
      metaMap.observe(() => {
        if (!cleanedUpRef.current) {
          syncFromMaps();
        }
      }),
      settingsMap.observe(() => {
        if (!cleanedUpRef.current) {
          syncFromMaps();
        }
      }),
      lightVariantMap.observe(() => {
        if (!cleanedUpRef.current) {
          syncFromMaps();
        }
      }),
      darkVariantMap.observe(() => {
        if (!cleanedUpRef.current) {
          syncFromMaps();
        }
      }),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [darkVariantMap, lightVariantMap, metaMap, settingsMap, syncFromMaps]);

  const setName = useCallback(
    (value: string) => {
      const parsedName = MapThemeDocumentMetaSchema.shape.name.safeParse(value);
      if (providerSynced && isDocumentReady && parsedName.success) {
        updateIntentField(fieldIntentsRef.current, parsedName.data, canonicalSnapshotRef.current?.name);
        metaMapRef.current?.set('name', parsedName.data);
      }
    },
    [isDocumentReady, providerSynced],
  );

  const updateSettings = useCallback(
    (values: Partial<MapThemeDocumentSettings>) => {
      if (providerSynced && isDocumentReady && Object.keys(values).length > 0) {
        updateIntentFields(fieldIntentsRef.current.settings, canonicalSnapshotRef.current?.settings, values);
        settingsMapRef.current?.setMany(values);
      }
    },
    [isDocumentReady, providerSynced],
  );

  const updateLightVariant = useCallback(
    (values: Partial<MapThemeDocumentVariant>) => {
      if (providerSynced && isDocumentReady && Object.keys(values).length > 0) {
        updateIntentFields(fieldIntentsRef.current.lightVariant, canonicalSnapshotRef.current?.lightVariant, values);
        lightVariantMapRef.current?.setMany(values);
      }
    },
    [isDocumentReady, providerSynced],
  );

  const updateDarkVariant = useCallback(
    (values: Partial<MapThemeDocumentVariant>) => {
      if (providerSynced && isDocumentReady && Object.keys(values).length > 0) {
        updateIntentFields(fieldIntentsRef.current.darkVariant, canonicalSnapshotRef.current?.darkVariant, values);
        darkVariantMapRef.current?.setMany(values);
      }
    },
    [isDocumentReady, providerSynced],
  );

  return {
    provider,
    doc,
    isConnected,
    isSynced: providerSynced && isDocumentReady && lastSyncedDocRef.current === doc,
    name,
    settings,
    lightVariant,
    darkVariant,
    setName,
    updateSettings,
    updateLightVariant,
    updateDarkVariant,
  };
}

function fromDocumentVariant(scheme: 'light' | 'dark', variant: MapThemeDocumentVariant): Omit<ThemeVariant, 'id'> {
  return {
    scheme,
    ...variant,
  };
}

function createEmptyFieldIntents(): MapThemeFieldIntents {
  return { settings: {}, lightVariant: {}, darkVariant: {} };
}

function cloneFieldIntents(intents: MapThemeFieldIntents): MapThemeFieldIntents {
  return {
    ...(intents.name === undefined ? {} : { name: intents.name }),
    settings: clonePartial(intents.settings),
    lightVariant: clonePartial(intents.lightVariant),
    darkVariant: clonePartial(intents.darkVariant),
  };
}

function cloneCanonicalSnapshot(snapshot: MapThemeCanonicalSnapshot): MapThemeCanonicalSnapshot {
  return {
    name: snapshot.name,
    settings: cloneValue(snapshot.settings),
    lightVariant: cloneValue(snapshot.lightVariant),
    darkVariant: cloneValue(snapshot.darkVariant),
  };
}

function clonePartial<T extends object>(value: Partial<T>): Partial<T> {
  return cloneValue(value);
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameFieldValue(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

function updateIntentField(intents: MapThemeFieldIntents, value: string, baseline: string | undefined): void {
  if (baseline !== undefined && sameFieldValue(value, baseline)) {
    delete intents.name;
  } else {
    intents.name = value;
  }
}

function updateIntentFields<T extends object>(target: Partial<T>, baseline: T | undefined, values: Partial<T>): void {
  for (const key of Object.keys(values) as Array<keyof T>) {
    const value = values[key];
    if (baseline && sameFieldValue(value, baseline[key])) {
      delete target[key];
    } else if (value !== undefined) {
      target[key] = cloneValue(value);
    }
  }
}

function onlyChangedFields(intents: MapThemeFieldIntents, canonical: MapThemeCanonicalSnapshot): MapThemeFieldIntents {
  const remaining = cloneFieldIntents(intents);
  if (remaining.name !== undefined && sameFieldValue(remaining.name, canonical.name)) {
    delete remaining.name;
  }
  removeSatisfiedFields(remaining.settings, canonical.settings);
  removeSatisfiedFields(remaining.lightVariant, canonical.lightVariant);
  removeSatisfiedFields(remaining.darkVariant, canonical.darkVariant);
  return remaining;
}

function removeSatisfiedFields<T extends object>(intents: Partial<T>, canonical: T): void {
  for (const key of Object.keys(intents) as Array<keyof T>) {
    if (sameFieldValue(intents[key], canonical[key])) {
      delete intents[key];
    }
  }
}

function applyFieldIntents(
  doc: Y.Doc,
  intents: MapThemeFieldIntents,
  metaMap: TypedMetaMap<typeof MapThemeDocumentMetaSchema> | null,
  settingsMap: TypedMetaMap<typeof MapThemeDocumentSettingsSchema> | null,
  lightVariantMap: TypedMetaMap<typeof MapThemeDocumentVariantSchema> | null,
  darkVariantMap: TypedMetaMap<typeof MapThemeDocumentVariantSchema> | null,
): boolean {
  if (!metaMap || !settingsMap || !lightVariantMap || !darkVariantMap) {
    return false;
  }

  let succeeded = true;
  doc.transact(() => {
    if (intents.name !== undefined) {
      succeeded = metaMap.set('name', intents.name) && succeeded;
    }
    if (Object.keys(intents.settings).length > 0) {
      succeeded = settingsMap.setMany(intents.settings) && succeeded;
    }
    if (Object.keys(intents.lightVariant).length > 0) {
      succeeded = lightVariantMap.setMany(intents.lightVariant) && succeeded;
    }
    if (Object.keys(intents.darkVariant).length > 0) {
      succeeded = darkVariantMap.setMany(intents.darkVariant) && succeeded;
    }
  });
  return succeeded;
}
