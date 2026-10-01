'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { updateWorkFieldsAction } from '@/lib/actions/work';
import { type CreditOrderItem, type WorkMeta, type WorkType } from '@/lib/collab/work-meta';
import { useBlockRoomConnection, type BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useLocaleDocumentSession, type LocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
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

interface PendingClientSave {
  request: number;
  observedAtSelection: string[];
  desiredClients: string[];
}

interface WorkMetaContextValue extends WorkMeta {
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
}

const WorkMetaContext = createContext<WorkMetaContextValue | null>(null);

export function WorkMetaProvider({
  workId,
  initialMeta,
  initialFeaturedImageUrl,
  children,
}: {
  workId: string;
  initialMeta: WorkMeta;
  initialFeaturedImageUrl: string | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<WorkMeta>(() => ({
    ...initialMeta,
    metadata: sanitizeWorkMetadata(initialMeta.metadata),
  }));
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl);
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
  const clientsWritesPending = useRef(0);
  const pendingClientSaves = useRef<PendingClientSave[]>([]);
  const activeClientSave = useRef<Promise<boolean> | null>(null);
  const setField = useCallback(<K extends keyof WorkMeta>(key: K, value: WorkMeta[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  }, []);
  const setPeriod = useCallback(
    (period: Pick<WorkMeta, 'year' | 'month' | 'untilYear' | 'untilMonth' | 'isPresent'>) => {
      setState((current) => ({ ...current, ...period }));
    },
    [],
  );
  const tCommon = useTranslations('common');
  const confirmedClients = useRef([...initialMeta.clients]);
  const visibleClients = useRef([...initialMeta.clients]);
  const clientsRequest = useRef(0);
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
            const result = await updateWorkFieldsAction(workId, { clients: clientsToSave, observedClients });
            if (result.error) {
              throw new Error(result.error);
            }
            confirmedClients.current = [...(result.clients ?? clientsToSave)];
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
            publishEditorEntityChange(`work:${workId}`);
          } catch (error) {
            if (aliveRef.current) {
              notifications.show({
                message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
                color: 'red',
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
  }, [setField, tCommon, workId]);
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
    const protectsClients = clientsWritesPending.current > 0;
    setState((current) => ({
      ...current,
      title: hasPending('sourceTitle') ? current.title : initialMeta.title,
      slug: hasPending('slug') ? current.slug : initialMeta.slug,
      type: hasPending('type') ? current.type : initialMeta.type,
      year: hasPending('year') ? current.year : initialMeta.year,
      month: hasPending('month') ? current.month : initialMeta.month,
      untilYear: hasPending('untilYear') ? current.untilYear : initialMeta.untilYear,
      untilMonth: hasPending('untilMonth') ? current.untilMonth : initialMeta.untilMonth,
      isPresent: hasPending('isPresent') ? current.isPresent : initialMeta.isPresent,
      summary: hasPending('summary') ? current.summary : initialMeta.summary,
      metadata: hasPending('metadata') ? current.metadata : sanitizeWorkMetadata(initialMeta.metadata),
      featured: hasPending('featured') ? current.featured : initialMeta.featured,
      clients: protectsClients ? current.clients : [...initialMeta.clients],
      // The edit route does not provide current credit order/version; keep the owning
      // credits query's state across route refreshes.
      creditOrder: current.creditOrder,
      creditsVersion: current.creditsVersion,
    }));
    if (!protectsClients) {
      confirmedClients.current = [...initialMeta.clients];
      visibleClients.current = [...initialMeta.clients];
    }
    setFeaturedImageUrl(initialFeaturedImageUrl);
  }, [
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
      const observedAtSelection = [...visibleClients.current];
      const desiredClients = [...clients];
      visibleClients.current = desiredClients;
      setField('clients', desiredClients);
      clientsWritesPending.current += 1;
      const request = ++clientsRequest.current;
      pendingClientSaves.current.push({ request, observedAtSelection, desiredClients });
      notifyEditorSaveStateChanged(`work:${workId}`);
      void drainClientSaves();
    },
    [drainClientSaves, setField, workId],
  );
  const setFeaturedImage = useCallback(
    (_fileId: string | null, url: string | null) => {
      if (!aliveRef.current) {
        return false;
      }
      setFeaturedImageUrl(url);
      return isConnected && isSynced;
    },
    [isConnected, isSynced],
  );

  const value = useMemo<WorkMetaContextValue>(
    () => ({
      ...state,
      workId,
      featuredImageUrl,
      setTitle: (title) => setField('title', title),
      setSlug: (slug) => setField('slug', slug),
      setType: (type) => setField('type', type),
      setYear: (year) => setField('year', year),
      setMonth: (month) => setField('month', month),
      setPeriod,
      setSummary: (summary) => setField('summary', summary),
      setMetadata: (metadata) => setField('metadata', sanitizeWorkMetadata(metadata)),
      setFeatured: (featured) => setField('featured', featured),
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
