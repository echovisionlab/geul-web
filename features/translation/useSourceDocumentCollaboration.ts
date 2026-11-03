'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  EMAIL_LAYOUT_CONTEXT_MAP_NAME,
  materializeEmailLayoutUnits,
  setEmailLayoutLocaleValue,
  unsetEmailLayoutLocaleValue,
  type MaterializedEmailLayoutUnit,
} from '@echovisionlab/geul-common/collaboration/email-layout';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import type * as Y from 'yjs';
import { getProviderAccessEnded, getProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { useHocuspocusConnection } from '@/lib/hooks/useHocuspocusConnection';
import { getActiveMember, subscribeSignedOutMembers } from '@/lib/auth/active-member';

function readTargetUnits(document: Y.Doc): MaterializedEmailLayoutUnit[] {
  const context = document.getMap<string>(EMAIL_LAYOUT_CONTEXT_MAP_NAME);
  const sourceLocale = context.get('sourceLocale');
  const locale = context.get('locale');
  if (!sourceLocale || !locale || sourceLocale === locale) {
    return [];
  }
  return materializeEmailLayoutUnits(document);
}

export function useEmailLayoutCollaboration(entityId: string, locale: string | null) {
  const member = useSyncExternalStore(subscribeSignedOutMembers, getActiveMember, () => null);
  const documentName = useMemo(
    () => (locale ? createDocumentName(CollaborativeDocumentType.EMAIL_LAYOUT, entityId, locale) : null),
    [entityId, locale],
  );
  const connection = useHocuspocusConnection({ documentName, connectionKey: member });
  const currentConnection = useRef({ ...connection, documentName, member });
  currentConnection.current = { ...connection, documentName, member };
  const [admitted, setAdmitted] = useState<{
    documentName: string;
    doc: Y.Doc;
    member: string | null;
    targetUnits: MaterializedEmailLayoutUnit[];
  } | null>(null);
  const retained =
    admitted?.documentName === documentName && admitted?.doc === connection.doc && admitted?.member === member
      ? admitted
      : null;
  const isDocumentReady = Boolean(documentName && connection.doc && (connection.isSynced || retained));

  useEffect(() => {
    const { doc } = connection;
    if (!doc || !documentName || !isDocumentReady) {
      return;
    }

    const refresh = () => setAdmitted({ documentName, doc, member, targetUnits: readTargetUnits(doc) });
    refresh();
    doc.on('update', refresh);
    return () => doc.off('update', refresh);
  }, [connection.doc, documentName, isDocumentReady, member]);

  const getEditableDocument = useCallback(() => {
    const current = currentConnection.current;
    const document = connection.doc;
    if (
      !document ||
      current.doc !== document ||
      current.provider !== connection.provider ||
      current.documentName !== documentName ||
      current.member !== member ||
      getActiveMember() !== member ||
      !current.isSynced ||
      getProviderAccessEnded(connection.provider) ||
      getProviderAccessLevel(connection.provider) === 'view'
    ) {
      return null;
    }
    return document;
  }, [connection.doc, connection.provider, documentName, member]);

  const setTargetValue = useCallback(
    (handle: string, value: string) => {
      const document = getEditableDocument();
      if (!document) {
        return;
      }
      document.transact(() => setEmailLayoutLocaleValue(document, handle, value));
    },
    [getEditableDocument],
  );

  const useSourceFallback = useCallback(
    (handle: string) => {
      const document = getEditableDocument();
      if (!document) {
        return;
      }
      document.transact(() => unsetEmailLayoutLocaleValue(document, handle));
    },
    [getEditableDocument],
  );

  return {
    ...connection,
    isDocumentReady,
    targetUnits: retained?.targetUnits ?? [],
    setTargetValue,
    useSourceFallback,
  };
}
