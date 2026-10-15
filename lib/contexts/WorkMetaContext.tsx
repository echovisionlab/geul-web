'use client';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { saveFailureFromAction } from '@/lib/editor/save-failure';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { notifications } from '@/components/core/Notification';
import { useTranslations } from 'next-intl';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { getWorkConfigurationAction, updateWorkFieldsAction } from '@/lib/actions/work';
import { type CreditOrderItem, type WorkMeta, type WorkType } from '@/lib/collab/work-meta';
import { useBlockRoomConnection, type BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useLocaleDocumentSession, type LocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import {
  useAuthoritativeConfiguration,
  type AuthoritativeConfiguration,
  type ConfigurationWrite,
} from '@/lib/editor/useAuthoritativeConfiguration';
import {
  getPendingEditorPatch,
  notifyEditorSaveStateChanged,
  registerEditorSave,
} from '@/lib/editor/editor-save-registry';

function sanitizeWorkMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const { year, month, untilYear, untilMonth, isPresent, periodYear, periodMonth, ...rest } = metadata;
  void year;
  void month;
  void untilYear;
  void untilMonth;
  void isPresent;
  void periodYear;
  void periodMonth;
  return rest;
}

function mergeClientIntent(current: string[], observed: string[], desired: string[]): string[] {
  const observedSet = new Set(observed);
  const desiredSet = new Set(desired);
  const merged = current.filter((clientId) => !(observedSet.has(clientId) && !desiredSet.has(clientId)));
  const mergedSet = new Set(merged);
  for (const clientId of desired) {
    if (!observedSet.has(clientId) && !mergedSet.has(clientId)) {
      merged.push(clientId);
      mergedSet.add(clientId);
    }
  }

  const desiredCommon = desired.filter((clientId) => observedSet.has(clientId));
  const observedCommon = observed.filter((clientId) => desiredSet.has(clientId));
  if (
    desiredCommon.length === observedCommon.length &&
    desiredCommon.every((clientId, index) => clientId === observedCommon[index])
  ) {
    return merged;
  }

  const reordered: string[] = [];
  const seen = new Set<string>();
  for (const clientId of desired) {
    if (mergedSet.has(clientId) && !seen.has(clientId)) {
      reordered.push(clientId);
      seen.add(clientId);
    }
  }
  for (const clientId of merged) {
    if (!seen.has(clientId)) {
      reordered.push(clientId);
      seen.add(clientId);
    }
  }
  return reordered;
}

export type WorkEditorConfiguration = WorkMeta & { mapPlaceId: string | null; featuredImageUrl: string | null };

interface PendingClientSave {
  request: number;
  observedAtSelection: string[];
  desiredClients: string[];
  write: ConfigurationWrite<WorkEditorConfiguration>;
}

export interface WorkMetaContextValue extends WorkMeta {
  workId: string;
  featuredImageUrl: string | null;
  setTitle: (title: string) => void;
  setSlug: (slug: string | null) => void;
  setType: (type: WorkType) => void;
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
  setPeriod: (period: Pick<WorkMeta, 'year' | 'month' | 'untilYear' | 'untilMonth' | 'isPresent'>) => void;
  setSummary: (summary: string) => void;
  setMetadata: (metadata: Record<string, unknown>) => void;
  setFeatured: (featured: boolean) => void;
  setFeaturedImage: (fileId: string | null, url: string | null) => boolean;
  incrementCreditsVersion: () => void;
  setCreditOrder: (order: CreditOrderItem[]) => void;
  setClients: (clients: string[]) => void;
  provider: HocuspocusProvider | null;
  doc: Y.Doc | null;
  isConnected: boolean;
  isSynced: boolean;
  bootstrap: BlockRoomConnection['bootstrap'];
  protocol: BlockRoomConnection['protocol'];
  acceptEpochAck: BlockRoomConnection['acceptEpochAck'];
  reloadCanonical: BlockRoomConnection['reloadCanonical'];
  roomLocale: string | null;
  localeSession: LocaleDocumentSession;
  configuration?: AuthoritativeConfiguration<WorkEditorConfiguration>;
  refreshConfiguration?: () => Promise<boolean>;
}

const WorkMetaContext = createContext<WorkMetaContextValue | null>(null);

/** Same state contract for local composition previews and the connected provider. */
export const WorkMetaStateProvider = WorkMetaContext.Provider;

export function WorkMetaProvider({
  workId,
  initialMeta,
  initialFeaturedImageUrl,
  initialMapPlaceId = null,
  canEdit: serverCanEdit = true,
  children,
}: {
  workId: string;
  initialMeta: WorkMeta;
  initialFeaturedImageUrl: string | null;
  initialMapPlaceId?: string | null;
  canEdit?: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<WorkMeta>(() => ({
    ...initialMeta,
    metadata: sanitizeWorkMetadata(initialMeta.metadata),
  }));
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl);
  const configuration = useAuthoritativeConfiguration<WorkEditorConfiguration>({
    document: `work:${workId}`,
    initialConfiguration: {
      ...initialMeta,
      metadata: sanitizeWorkMetadata(initialMeta.metadata),
      mapPlaceId: initialMapPlaceId,
      featuredImageUrl: initialFeaturedImageUrl,
    },
    onAdopt: (patch) => {
      setState((current) => ({ ...current, ...patch }));
      if (Object.hasOwn(patch, 'featuredImageUrl')) {
        setFeaturedImageUrl(patch.featuredImageUrl ?? null);
      }
    },
  });
  const aliveRef = useRef(false);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, [workId]);
  const localeSession = useLocaleDocumentSession({
    entityType: 'work',
    entityId: workId,
    sourceTitle: state.title,
    sourceSummary: state.summary,
  });
  const { roomLocale } = localeSession;
  const connection = useBlockRoomConnection('work', workId, roomLocale);
  const { provider, doc, isConnected, isSynced, bootstrap, protocol, acceptEpochAck, reloadCanonical } = connection;
  const accessLevel = useEditorAccessLevel(provider);
  const canEdit = serverCanEdit && accessLevel === 'edit';
  const clientsWritesPending = useRef(0);
  const pendingClientSaves = useRef<PendingClientSave[]>([]);
  const activeClientSave = useRef<Promise<boolean> | null>(null);
  const setField = useCallback(
    <K extends keyof WorkMeta>(key: K, value: WorkMeta[K]) => {
      if (
        ['slug', 'type', 'year', 'month', 'untilYear', 'untilMonth', 'isPresent', 'metadata', 'featured'].includes(key)
      ) {
        configuration.edit({ [key]: value } as Partial<WorkEditorConfiguration>);
      } else {
        setState((current) => ({ ...current, [key]: value }));
      }
    },
    [configuration],
  );
  const setPeriod = useCallback(
    (period: Pick<WorkMeta, 'year' | 'month' | 'untilYear' | 'untilMonth' | 'isPresent'>) => {
      if (canEdit) {
        configuration.edit(period);
      }
    },
    [canEdit, configuration],
  );
  const tCommon = useTranslations('common');
  const confirmedClients = useRef([...initialMeta.clients]);
  const visibleClients = useRef([...initialMeta.clients]);
  const clientsRequest = useRef(0);
  const refreshConfiguration = useCallback(async () => {
    const read = configuration.beginRead();
    let result;
    try {
      result = await getWorkConfigurationAction(workId);
    } catch {
      return false;
    }
    if (!configuration.isActive() || !result.data) {
      return false;
    }
    const {
      slug,
      type,
      year,
      month,
      untilYear,
      untilMonth,
      isPresent,
      featured,
      clients,
      mapPlaceId,
      featuredImageUrl,
    } = result.data;
    const snapshot = {
      slug,
      type,
      year,
      month,
      untilYear,
      untilMonth,
      isPresent,
      featured,
      clients,
      mapPlaceId,
      featuredImageUrl,
      metadata: sanitizeWorkMetadata(result.data.metadata),
    };
    const adopted = configuration.adoptRead(read, snapshot);
    if (adopted && !configuration.isDraft('clients') && clientsWritesPending.current === 0) {
      confirmedClients.current = [...snapshot.clients];
      visibleClients.current = [...snapshot.clients];
    }
    return adopted;
  }, [configuration, workId]);
  const routeSeeded = useRef(false);

  const drainClientSaves = useCallback((): Promise<boolean> => {
    if (activeClientSave.current) {
      return activeClientSave.current;
    }
    if (pendingClientSaves.current.length === 0) {
      return Promise.resolve(true);
    }

    const operation = Promise.resolve().then(async () => {
      try {
        while (pendingClientSaves.current.length > 0) {
          const pending = pendingClientSaves.current[0];
          const observedClients = [...confirmedClients.current];
          const clientsToSave = mergeClientIntent(observedClients, pending.observedAtSelection, pending.desiredClients);
          try {
            const result = await updateWorkFieldsAction(
              workId,
              { clients: clientsToSave, observedClients },
              pending.write.origin,
            );
            if (result.error) {
              throw saveFailureFromAction({ error: result.error, errorCode: result.errorCode });
            }
            const acknowledged = pending.write.acknowledge(
              { clients: [...(result.clients ?? clientsToSave)] },
              { authoritative: result.clients !== undefined },
            );
            confirmedClients.current = [...configuration.getCanonical().clients];
            if (!acknowledged) {
              void refreshConfiguration();
            }
            pendingClientSaves.current.shift();
            clientsWritesPending.current = Math.max(0, clientsWritesPending.current - 1);
            notifyEditorSaveStateChanged(`work:${workId}`);
            if (
              pending.request === clientsRequest.current &&
              pendingClientSaves.current.length === 0 &&
              aliveRef.current
            ) {
              visibleClients.current = [...confirmedClients.current];
              setField('clients', visibleClients.current);
            }
            publishEditorEntityChange(`work:${workId}`, pending.write.origin);
          } catch (error) {
            if (aliveRef.current) {
              notifications.show({
                message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
                tone: 'danger',
              });
            }
            notifyEditorSaveStateChanged(`work:${workId}`);
            // Retain this request and later selections. Navigation/lifecycle flushes
            // remain blocked and can retry the same intent.
            return false;
          }
        }
        return true;
      } finally {
        if (activeClientSave.current === operation) {
          activeClientSave.current = null;
        }
        notifyEditorSaveStateChanged(`work:${workId}`);
      }
    });
    activeClientSave.current = operation;
    notifyEditorSaveStateChanged(`work:${workId}`);
    return operation;
  }, [configuration, refreshConfiguration, setField, tCommon, workId]);
  const clientsEditorSave = useMemo(
    () => ({
      flush: drainClientSaves,
      hasPending: () => pendingClientSaves.current.length > 0 || activeClientSave.current !== null,
      getPendingPatch: () => (pendingClientSaves.current.length > 0 ? { clients: [...visibleClients.current] } : null),
    }),
    [drainClientSaves],
  );
  useEffect(() => registerEditorSave(`work:${workId}`, clientsEditorSave), [clientsEditorSave, workId]);
  useEffect(() => {
    const pending = getPendingEditorPatch(`work:${workId}`);
    const hasPending = (field: string) => Object.hasOwn(pending, field);
    // Route props do not carry read-start information. After the initial seed,
    // neutral settings always reload through a ticket tied to the actual authorized RPC.
    if (routeSeeded.current) {
      void refreshConfiguration();
    } else {
      routeSeeded.current = true;
    }
    setState((current) => ({
      ...current,
      title: hasPending('sourceTitle') ? current.title : initialMeta.title,
      summary: hasPending('summary') ? current.summary : initialMeta.summary,
      // The edit route does not provide current credit order/version; keep the owning
      // credits query's state across route refreshes.
      creditOrder: current.creditOrder,
      creditsVersion: current.creditsVersion,
    }));
  }, [
    configuration,
    refreshConfiguration,
    initialMapPlaceId,
    initialFeaturedImageUrl,
    initialMeta.clients,
    initialMeta.featured,
    initialMeta.isPresent,
    initialMeta.metadata,
    initialMeta.month,
    initialMeta.slug,
    initialMeta.summary,
    initialMeta.title,
    initialMeta.type,
    initialMeta.untilMonth,
    initialMeta.untilYear,
    initialMeta.year,
    workId,
  ]);
  const setClients = useCallback(
    (clients: string[]) => {
      if (!canEdit) {
        return;
      }
      const observedAtSelection = [...visibleClients.current];
      const desiredClients = [...clients];
      visibleClients.current = desiredClients;
      configuration.setDraft('clients', desiredClients);
      const write = configuration.beginWrite(['clients']);
      clientsWritesPending.current += 1;
      const request = ++clientsRequest.current;
      pendingClientSaves.current.push({ request, observedAtSelection, desiredClients, write });
      notifyEditorSaveStateChanged(`work:${workId}`);
      void drainClientSaves();
    },
    [canEdit, configuration, drainClientSaves, workId],
  );
  const setFeaturedImage = useCallback(
    (_fileId: string | null, url: string | null) => {
      if (!canEdit || !aliveRef.current) {
        return false;
      }
      configuration.edit({ featuredImageUrl: url });
      const write = configuration.beginWrite(['featuredImageUrl']);
      write.acknowledge({ featuredImageUrl: url }, { authoritative: false });
      return isConnected && isSynced;
    },
    [canEdit, configuration, isConnected, isSynced],
  );

  const value = useMemo<WorkMetaContextValue>(
    () => ({
      ...state,
      configuration,
      refreshConfiguration,
      workId,
      featuredImageUrl,
      setTitle: (title) => canEdit && setField('title', title),
      setSlug: (slug) => canEdit && setField('slug', slug),
      setType: (type) => canEdit && setField('type', type),
      setYear: (year) => canEdit && setField('year', year),
      setMonth: (month) => canEdit && setField('month', month),
      setPeriod,
      setSummary: (summary) => canEdit && setField('summary', summary),
      setMetadata: (metadata) => canEdit && setField('metadata', sanitizeWorkMetadata(metadata)),
      setFeatured: (featured) => canEdit && setField('featured', featured),
      setFeaturedImage,
      incrementCreditsVersion: () => setField('creditsVersion', state.creditsVersion + 1),
      setCreditOrder: (order) => setField('creditOrder', order),
      setClients,
      provider,
      doc,
      isConnected,
      isSynced,
      bootstrap,
      protocol,
      acceptEpochAck,
      reloadCanonical,
      roomLocale,
      localeSession,
    }),
    [
      canEdit,
      configuration,
      refreshConfiguration,
      acceptEpochAck,
      bootstrap,
      protocol,
      doc,
      featuredImageUrl,
      isConnected,
      isSynced,
      provider,
      reloadCanonical,
      roomLocale,
      localeSession,
      setClients,
      setFeaturedImage,
      setField,
      setPeriod,
      state,
      workId,
    ],
  );

  return <WorkMetaContext.Provider value={value}>{children}</WorkMetaContext.Provider>;
}

export function useWorkMeta(): WorkMetaContextValue {
  const context = useContext(WorkMetaContext);
  if (!context) {
    throw new Error('useWorkMeta must be used within a WorkMetaProvider');
  }
  return context;
}

export type { WorkType, WorkMeta } from '@/lib/collab/work-meta';
