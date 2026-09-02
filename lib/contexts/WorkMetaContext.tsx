'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { updateWorkFieldsAction } from '@/lib/actions/work';
import { type CreditOrderItem, type WorkMeta, type WorkType } from '@/lib/collab/work-meta';
import { useBlockRoomConnection, type BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useLocaleDocumentSession, type LocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';

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
  const setField = useCallback(<K extends keyof WorkMeta>(key: K, value: WorkMeta[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  }, []);
  const setPeriod = useCallback(
    (period: Pick<WorkMeta, 'year' | 'month' | 'untilYear' | 'untilMonth' | 'isPresent'>) => {
      setState((current) => ({ ...current, ...period }));
    },
    [],
  );
  const setClients = useCallback(
    (clients: string[]) => {
      setField('clients', clients);
      void updateWorkFieldsAction(workId, { clients });
    },
    [setField, workId],
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
