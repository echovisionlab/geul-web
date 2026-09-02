'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  POST_SERIES_CONTEXT_MAP_NAME,
  materializePostSeriesLocaleFields,
  setPostSeriesLocaleField,
  type PostSeriesLocaleFields,
} from '@echovisionlab/geul-common/collaboration/post-series';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import type * as Y from 'yjs';
import { useHocuspocusConnection } from '@/lib/hooks/useHocuspocusConnection';

interface PostSeriesRoomState {
  sourceLocale: string;
  locale: string;
  fields: PostSeriesLocaleFields;
}

function readRoomState(document: Y.Doc): PostSeriesRoomState | null {
  const context = document.getMap<string>(POST_SERIES_CONTEXT_MAP_NAME);
  const sourceLocale = context.get('sourceLocale');
  const locale = context.get('locale');
  if (!sourceLocale || !locale) {
    return null;
  }
  return {
    sourceLocale,
    locale,
    fields: materializePostSeriesLocaleFields(document),
  };
}

export function usePostSeriesCollaboration(seriesId: string, locale: string | null) {
  const documentName = useMemo(
    () => (locale ? createDocumentName(CollaborativeDocumentType.POST_SERIES, seriesId, locale) : null),
    [locale, seriesId],
  );
  const connection = useHocuspocusConnection({ documentName });
  const [roomState, setRoomState] = useState<PostSeriesRoomState | null>(null);

  useEffect(() => {
    const { doc, isSynced } = connection;
    if (!doc || !isSynced) {
      setRoomState(null);
      return;
    }

    const refresh = () => setRoomState(readRoomState(doc));
    refresh();
    doc.on('update', refresh);
    return () => doc.off('update', refresh);
  }, [connection.doc, connection.isSynced, documentName]);

  const setField = useCallback(
    (field: keyof PostSeriesLocaleFields, value: string) => {
      const document = connection.doc;
      if (!document || !connection.isSynced) {
        return;
      }
      document.transact(() => setPostSeriesLocaleField(document, field, value));
    },
    [connection.doc, connection.isSynced],
  );

  return {
    ...connection,
    roomState,
    setField,
  };
}
