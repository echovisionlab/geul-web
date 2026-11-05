'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { createBlockId } from '@/lib/editor/block-id';
import { createTiptapEditorGeneration } from '@/features/editor/tiptap/editor-generation';
import type { InsertPosition } from '@/features/editor/lib/block-insert';

// ============================================================================
// Map Insert State
// ============================================================================

export interface MapInsertState {
  isOpen: boolean;
  position: InsertPosition | null;
  error: MapInsertFailureReason | null;
}

export type MapInsertFailureReason = 'missing_reference' | 'unsupported_block' | 'unavailable';

export type MapInsertResult = { ok: true; blockId: string } | { ok: false; reason: MapInsertFailureReason };

export interface EditorMapCommandPort {
  captureInsertPosition: () => InsertPosition | null;
  insertMapBlock: (
    block: { id: string; type: 'map'; props: Record<string, unknown> },
    savedPosition: InsertPosition | null,
  ) => MapInsertResult;
}

export interface EditorMapBlock {
  id: string;
  type: 'map';
  props: Record<string, unknown>;
}

interface UseMapInsertOptions {
  port?: EditorMapCommandPort | null;
  enabled?: boolean;
}

function findTiptapBlock(editor: Editor, blockId: string) {
  let found: { id: string; position: number; nodeSize: number } | null = null;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'blockContainer' && String(node.attrs.id ?? '') === blockId) {
      found = { id: blockId, position, nodeSize: node.nodeSize };
      return false;
    }
    return !found;
  });
  return found;
}

function findCurrentOrLastTiptapBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'blockContainer') {
      const position = $from.before(depth);
      const node = editor.state.doc.nodeAt(position);
      const id = String(node?.attrs.id ?? '');
      return id && node ? { id, position, nodeSize: node.nodeSize } : null;
    }
  }
  let last: { id: string; position: number; nodeSize: number } | null = null;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'blockContainer' && node.attrs.id) {
      last = { id: String(node.attrs.id), position, nodeSize: node.nodeSize };
    }
  });
  return last;
}

/** Native map command port. It retains the captured block anchor across the picker flow. */
export function createTiptapMapCommandPort(editor: Editor): EditorMapCommandPort {
  const editorGeneration = createTiptapEditorGeneration(editor);
  return {
    captureInsertPosition: () => {
      const currentEditor = editorGeneration.current();
      if (!currentEditor) {
        return null;
      }
      const reference = findCurrentOrLastTiptapBlock(currentEditor);
      return reference ? { referenceBlockId: reference.id } : null;
    },
    insertMapBlock(block, savedPosition) {
      const currentEditor = editorGeneration.current();
      if (!currentEditor) {
        return { ok: false, reason: 'unavailable' };
      }
      const blockContainer = currentEditor.schema.nodes.blockContainer;
      const map = currentEditor.schema.nodes.map;
      if (!blockContainer || !map) {
        return { ok: false, reason: 'unsupported_block' };
      }
      const content = map.createAndFill(block.props);
      if (!content) {
        return { ok: false, reason: 'unsupported_block' };
      }
      const reference =
        (savedPosition ? findTiptapBlock(currentEditor, savedPosition.referenceBlockId) : null) ??
        findCurrentOrLastTiptapBlock(currentEditor);
      if (!reference) {
        return { ok: false, reason: 'missing_reference' };
      }
      currentEditor.view.dispatch(
        currentEditor.state.tr
          .insert(reference.position + reference.nodeSize, blockContainer.create({ id: block.id }, content))
          .scrollIntoView(),
      );
      return { ok: true, blockId: block.id };
    },
  };
}

export function createMapBlock(placeId: string, placeData: { lat: number; lng: number }): EditorMapBlock {
  const id = createBlockId();
  return {
    id,
    type: 'map' as const,
    props: {
      mapPlaceIds: placeId,
      centerLat: String(placeData.lat),
      centerLng: String(placeData.lng),
      displaySize: '100',
    },
  };
}

export function useMapInsert(editor: Editor | null, options: UseMapInsertOptions = {}) {
  const { enabled = true, port: suppliedPort } = options;
  const nativePort = useMemo(() => (editor ? createTiptapMapCommandPort(editor) : null), [editor]);
  const port = suppliedPort ?? nativePort;
  const [mapInsert, setMapInsert] = useState<MapInsertState>({
    isOpen: false,
    position: null,
    error: null,
  });

  const openMapInsert = useCallback(() => {
    if (!enabled || !port) {
      return;
    }
    setMapInsert({ isOpen: true, position: port.captureInsertPosition(), error: null });
  }, [enabled, port]);

  const closeMapInsert = useCallback(() => {
    setMapInsert({ isOpen: false, position: null, error: null });
  }, []);

  useEffect(() => {
    if (!enabled) {
      closeMapInsert();
    }
  }, [closeMapInsert, enabled]);

  const handleMapPlaceSelect = useCallback(
    (placeId: string | null, placeData: { lat: number; lng: number } | null) => {
      if (!enabled || !port || !placeId || !placeData) {
        return { ok: false, reason: 'unavailable' } as const;
      }
      const result = port.insertMapBlock(createMapBlock(placeId, placeData), mapInsert.position);
      if (!result.ok) {
        setMapInsert((current) => ({ ...current, error: result.reason }));
        return result;
      }
      closeMapInsert();
      return result;
    },
    [closeMapInsert, enabled, mapInsert.position, port],
  );

  return {
    mapInsert,
    openMapInsert,
    closeMapInsert,
    handleMapPlaceSelect,
  };
}
