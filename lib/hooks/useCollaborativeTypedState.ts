'use client';

import { getProviderAccessEnded, getProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import type { TypedMetaMap } from '@/lib/collab/TypedMetaMap';
import type * as z from '@/lib/zod-mini';
import { useHocuspocusConnection } from './useHocuspocusConnection';

/** An object schema from either zod entry point (Common's collaboration schemas use classic zod). */
type ZodObjectSchema = z.core.$ZodObject;
type SchemaState<TSchema extends ZodObjectSchema> = z.infer<TSchema>;
type SchemaKey<TSchema extends ZodObjectSchema> = keyof SchemaState<TSchema> & string;

interface UseCollaborativeTypedStateOptions<TSchema extends ZodObjectSchema> {
  documentName: string | null;
  connectionKey?: string | number | null;
  createMap: (doc: Y.Doc) => TypedMetaMap<TSchema>;
  defaults: SchemaState<TSchema>;
  initialState?: Partial<SchemaState<TSchema>>;
  /**
   * Whether a local initial state should be written into a freshly synced
   * document. Server-hydrated document types must disable this so the local
   * fallback cannot overwrite the canonical state returned by the server.
   */
  initializeOnSync?: boolean;
  prepareSyncedDocument?: (doc: Y.Doc) => void;
  normalizeInitialState?: (state: SchemaState<TSchema>) => SchemaState<TSchema>;
  normalizeSyncedState?: (state: SchemaState<TSchema>, map: TypedMetaMap<TSchema>) => SchemaState<TSchema>;
}

interface UseCollaborativeTypedStateResult<TSchema extends ZodObjectSchema> {
  provider: HocuspocusProvider | null;
  doc: Y.Doc | null;
  metaMap: TypedMetaMap<TSchema> | null;
  isConnected: boolean;
  isSynced: boolean;
  state: SchemaState<TSchema>;
  setField: <K extends SchemaKey<TSchema>>(key: K, value: SchemaState<TSchema>[K]) => void;
  setFields: (values: Partial<SchemaState<TSchema>>) => void;
}

function resolveFieldValue<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function useCollaborativeTypedState<TSchema extends ZodObjectSchema>({
  documentName,
  connectionKey = null,
  createMap,
  defaults,
  initialState,
  initializeOnSync = true,
  prepareSyncedDocument,
  normalizeInitialState,
  normalizeSyncedState,
}: UseCollaborativeTypedStateOptions<TSchema>): UseCollaborativeTypedStateResult<TSchema> {
  const initialStateRef = useRef(initialState);
  initialStateRef.current = initialState;
  const prepareSyncedDocumentRef = useRef(prepareSyncedDocument);
  prepareSyncedDocumentRef.current = prepareSyncedDocument;
  const initializeOnSyncRef = useRef(initializeOnSync);
  initializeOnSyncRef.current = initializeOnSync;
  const normalizeInitialStateRef = useRef(normalizeInitialState);
  normalizeInitialStateRef.current = normalizeInitialState;
  const normalizeSyncedStateRef = useRef(normalizeSyncedState);
  normalizeSyncedStateRef.current = normalizeSyncedState;

  const metaMapRef = useRef<TypedMetaMap<TSchema> | null>(null);
  const cleanedUpRef = useRef(false);

  const buildBaseState = useCallback((): SchemaState<TSchema> => {
    const merged = {
      ...defaults,
      ...initialStateRef.current,
    } as SchemaState<TSchema>;

    return normalizeInitialStateRef.current ? normalizeInitialStateRef.current(merged) : merged;
  }, [defaults]);

  const [state, setState] = useState<SchemaState<TSchema>>(() => buildBaseState());

  const handleSynced = useCallback(
    (syncedDoc: Y.Doc) => {
      if (cleanedUpRef.current) {
        return;
      }

      prepareSyncedDocumentRef.current?.(syncedDoc);
      const nextMetaMap = createMap(syncedDoc);
      metaMapRef.current = nextMetaMap;

      if (initializeOnSyncRef.current) {
        nextMetaMap.initAll(buildBaseState());
      }

      const nextState = nextMetaMap.getAllWithDefaults(defaults);
      setState(normalizeSyncedStateRef.current ? normalizeSyncedStateRef.current(nextState, nextMetaMap) : nextState);
    },
    [buildBaseState, createMap, defaults],
  );

  const { provider, doc, isConnected, isSynced } = useHocuspocusConnection({
    documentName,
    onSynced: handleSynced,
    connectionKey,
  });

  const providerRef = useRef(provider);
  providerRef.current = provider;

  const metaMap = useMemo(() => {
    return doc ? createMap(doc) : null;
  }, [createMap, doc]);

  useEffect(() => {
    if (!doc || !prepareSyncedDocumentRef.current) {
      return;
    }

    const enforcePreparedDocument = () => prepareSyncedDocumentRef.current?.(doc);
    enforcePreparedDocument();
    doc.on('update', enforcePreparedDocument);
    return () => doc.off('update', enforcePreparedDocument);
  }, [doc, documentName]);

  useEffect(() => {
    metaMapRef.current = metaMap;
  }, [metaMap]);

  useEffect(() => {
    cleanedUpRef.current = false;
    return () => {
      cleanedUpRef.current = true;
    };
  }, [documentName]);

  useEffect(() => {
    metaMapRef.current = null;
    setState(buildBaseState());
  }, [buildBaseState, documentName]);

  useEffect(() => {
    if (!metaMap) {
      return;
    }

    return metaMap.observe((changedKeys) => {
      if (cleanedUpRef.current) {
        return;
      }

      const baseState = buildBaseState();
      setState((prev) => {
        const patch: Partial<SchemaState<TSchema>> = {};

        changedKeys.forEach((key) => {
          const value = metaMap.get(key);
          Object.assign(patch, { [key]: resolveFieldValue(value, baseState[key]) });
        });

        return { ...prev, ...patch };
      });
    });
  }, [buildBaseState, metaMap]);

  const setField = useCallback(<K extends SchemaKey<TSchema>>(key: K, value: SchemaState<TSchema>[K]) => {
    if (getProviderAccessEnded(providerRef.current) || getProviderAccessLevel(providerRef.current) === 'view') {
      return;
    }
    setState((prev) => ({ ...prev, [key]: value }));
    metaMapRef.current?.set(key, value);
  }, []);

  const setFields = useCallback((values: Partial<SchemaState<TSchema>>) => {
    if (getProviderAccessEnded(providerRef.current) || getProviderAccessLevel(providerRef.current) === 'view') {
      return;
    }
    setState((prev) => ({ ...prev, ...values }));
    metaMapRef.current?.setMany(values);
  }, []);

  return {
    provider,
    doc,
    metaMap,
    isConnected,
    isSynced,
    state,
    setField,
    setFields,
  };
}
