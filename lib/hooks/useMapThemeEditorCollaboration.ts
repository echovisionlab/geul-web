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
import type { ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { useHocuspocusConnection } from './useHocuspocusConnection';

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
  const metaMapRef = useRef<TypedMetaMap<typeof MapThemeDocumentMetaSchema> | null>(null);
  const settingsMapRef = useRef<TypedMetaMap<typeof MapThemeDocumentSettingsSchema> | null>(null);
  const lightVariantMapRef = useRef<TypedMetaMap<typeof MapThemeDocumentVariantSchema> | null>(null);
  const darkVariantMapRef = useRef<TypedMetaMap<typeof MapThemeDocumentVariantSchema> | null>(null);

  const syncFromMaps = useCallback(() => {
    if (!metaMapRef.current || !settingsMapRef.current || !lightVariantMapRef.current || !darkVariantMapRef.current) {
      return;
    }

    const metaResult = MapThemeDocumentMetaSchema.safeParse(metaMapRef.current.getAll());
    const settingsResult = MapThemeDocumentSettingsSchema.safeParse(settingsMapRef.current.getAll());
    const lightResult = MapThemeDocumentVariantSchema.safeParse(lightVariantMapRef.current.getAll());
    const darkResult = MapThemeDocumentVariantSchema.safeParse(darkVariantMapRef.current.getAll());
    if (!metaResult.success || !settingsResult.success || !lightResult.success || !darkResult.success) {
      setIsDocumentReady(false);
      return;
    }

    const meta = metaResult.data;
    const nextSettings = settingsResult.data;
    const nextLightVariant = fromDocumentVariant('light', lightResult.data);
    const nextDarkVariant = fromDocumentVariant('dark', darkResult.data);

    setNameState(meta.name);
    setSettingsState(nextSettings);
    setLightVariantState(nextLightVariant);
    setDarkVariantState(nextDarkVariant);
    setIsDocumentReady(true);
  }, []);

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
  });

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
    if (providerSynced) {
      syncFromMaps();
    }
  }, [darkVariantMap, lightVariantMap, metaMap, providerSynced, settingsMap, syncFromMaps]);

  useEffect(() => {
    cleanedUpRef.current = false;
    return () => {
      cleanedUpRef.current = true;
    };
  }, [themeId]);

  useEffect(() => {
    if (!initialState || providerSynced) {
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
        metaMapRef.current?.set('name', parsedName.data);
      }
    },
    [isDocumentReady, providerSynced],
  );

  const updateSettings = useCallback(
    (values: Partial<MapThemeDocumentSettings>) => {
      if (providerSynced && isDocumentReady && Object.keys(values).length > 0) {
        settingsMapRef.current?.setMany(values);
      }
    },
    [isDocumentReady, providerSynced],
  );

  const updateLightVariant = useCallback(
    (values: Partial<MapThemeDocumentVariant>) => {
      if (providerSynced && isDocumentReady && Object.keys(values).length > 0) {
        lightVariantMapRef.current?.setMany(values);
      }
    },
    [isDocumentReady, providerSynced],
  );

  const updateDarkVariant = useCallback(
    (values: Partial<MapThemeDocumentVariant>) => {
      if (providerSynced && isDocumentReady && Object.keys(values).length > 0) {
        darkVariantMapRef.current?.setMany(values);
      }
    },
    [isDocumentReady, providerSynced],
  );

  return {
    provider,
    doc,
    isConnected,
    isSynced: providerSynced && isDocumentReady,
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
