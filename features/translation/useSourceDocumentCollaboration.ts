'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EMAIL_LAYOUT_CONTEXT_MAP_NAME,
  materializeEmailLayoutUnits,
  setEmailLayoutLocaleValue,
  unsetEmailLayoutLocaleValue,
  type MaterializedEmailLayoutUnit,
} from '@echovisionlab/geul-common/collaboration/email-layout';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import type * as Y from 'yjs';
import { useHocuspocusConnection } from '@/lib/hooks/useHocuspocusConnection';

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
  const documentName = useMemo(
    () => (locale ? createDocumentName(CollaborativeDocumentType.EMAIL_LAYOUT, entityId, locale) : null),
    [entityId, locale],
  );
  const connection = useHocuspocusConnection({ documentName });
  const [targetUnits, setTargetUnits] = useState<MaterializedEmailLayoutUnit[]>([]);

  useEffect(() => {
    const { doc, isSynced } = connection;
    if (!doc || !isSynced) {
      setTargetUnits([]);
      return;
    }

    const refresh = () => setTargetUnits(readTargetUnits(doc));
    refresh();
    doc.on('update', refresh);
    return () => doc.off('update', refresh);
  }, [connection.doc, connection.isSynced, documentName]);

  const setTargetValue = useCallback(
    (handle: string, value: string) => {
      const document = connection.doc;
      if (!document || !connection.isSynced) {
        return;
      }
      document.transact(() => setEmailLayoutLocaleValue(document, handle, value));
    },
    [connection.doc, connection.isSynced],
  );

  const useSourceFallback = useCallback(
    (handle: string) => {
      const document = connection.doc;
      if (!document || !connection.isSynced) {
        return;
      }
      document.transact(() => unsetEmailLayoutLocaleValue(document, handle));
    },
    [connection.doc, connection.isSynced],
  );

  return {
    ...connection,
    targetUnits,
    setTargetValue,
    useSourceFallback,
  };
}
