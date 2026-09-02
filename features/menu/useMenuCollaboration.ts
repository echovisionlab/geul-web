'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import {
  MENU_CONTEXT_MAP_NAME,
  extractMenuCanonicalSnapshot,
  materializeMenuCanonicalItems,
  replaceMenuCanonicalSource,
  setMenuLocaleLabel,
  unsetMenuLocaleLabel,
  type MenuCollaborationItem,
} from '@echovisionlab/geul-common/collaboration/menu';
import type * as Y from 'yjs';
import { useHocuspocusConnection } from '@/lib/hooks/useHocuspocusConnection';
import type { MenuItem } from './menu-editor-model';

export interface MenuRoomState {
  sourceLocale: string;
  locale: string;
  localeExists: boolean;
  name: string;
  items: MenuItem[];
  requestedLabels: Readonly<Record<string, string>>;
}

function readRoomState(document: Y.Doc): MenuRoomState | null {
  const context = document.getMap<string | boolean>(MENU_CONTEXT_MAP_NAME);
  const sourceLocale = context.get('sourceLocale');
  const locale = context.get('locale');
  if (typeof sourceLocale !== 'string' || typeof locale !== 'string') {
    return null;
  }
  const snapshot = extractMenuCanonicalSnapshot(document);
  return {
    sourceLocale,
    locale,
    localeExists: context.get('localeExists') === true,
    name: snapshot.name,
    items: materializeMenuCanonicalItems(document).map(fromCollaborationItem),
    requestedLabels: snapshot.requestedLabels,
  };
}

export function useMenuCollaboration(menuId: string, locale: string | null) {
  const documentName = useMemo(
    () => (locale ? createDocumentName(CollaborativeDocumentType.MENU, menuId, locale) : null),
    [locale, menuId],
  );
  const connection = useHocuspocusConnection({ documentName });
  const [roomState, setRoomState] = useState<MenuRoomState | null>(null);

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

  const replaceSource = useCallback(
    (name: string, items: readonly MenuItem[]) => {
      if (!connection.doc || !connection.isSynced) {
        return;
      }
      connection.doc.transact(() => replaceMenuCanonicalSource(connection.doc!, name, items.map(toCollaborationItem)));
    },
    [connection.doc, connection.isSynced],
  );

  const setLabel = useCallback(
    (itemId: string, value: string) => {
      if (!connection.doc || !connection.isSynced) {
        return;
      }
      connection.doc.transact(() => setMenuLocaleLabel(connection.doc!, itemId, value));
    },
    [connection.doc, connection.isSynced],
  );

  const useSourceLabel = useCallback(
    (itemId: string) => {
      if (!connection.doc || !connection.isSynced) {
        return;
      }
      connection.doc.transact(() => unsetMenuLocaleLabel(connection.doc!, itemId));
    },
    [connection.doc, connection.isSynced],
  );

  return { ...connection, roomState, replaceSource, setLabel, useSourceLabel };
}

function fromCollaborationItem(item: MenuCollaborationItem): MenuItem {
  return {
    id: item.id,
    label: item.label ?? '',
    linkType: item.linkType,
    url: item.url,
    targetId: item.targetId,
    targetSlug: item.targetSlug,
    openInNewTab: item.openInNewTab,
    localizationMode: item.localizationMode as MenuItem['localizationMode'],
    fixedLocale: item.fixedLocale,
    visibility: item.visibilityMode ? { mode: item.visibilityMode, roles: item.visibilityRoles } : undefined,
    children: item.children?.map(fromCollaborationItem),
  };
}

function toCollaborationItem(item: MenuItem): MenuCollaborationItem {
  return {
    id: item.id,
    label: item.label,
    linkType: item.linkType,
    url: item.url,
    targetId: item.targetId,
    targetSlug: item.targetSlug,
    openInNewTab: item.openInNewTab,
    visibilityMode: item.visibility?.mode,
    visibilityRoles: item.visibility?.roles,
    localizationMode: item.localizationMode,
    fixedLocale: item.fixedLocale,
    children: item.children?.map(toCollaborationItem),
  };
}
