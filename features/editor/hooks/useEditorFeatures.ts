'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useWindowEvent } from '@mantine/hooks';
import type { AIEditorContext } from '@/lib/editor/ai-support';
import { createBlockId } from '@/lib/editor/block-id';
import { createTiptapEditorGeneration } from '@/features/editor/tiptap/editor-generation';
import { resolveTiptapAIContext, type TiptapAINodeTypes } from '@/features/editor/tiptap/ai/tiptap-ai';
import type { InsertPosition } from '@/features/editor/lib/block-insert';
import { createClientLogger } from '@/lib/utils/client-logger';

const aiLogger = createClientLogger('useAIAssistant');

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

function getEditorDiagnostics(editor: Editor, fallbackBlockId?: string) {
  const tiptapSelection = editor.state.selection;

  const browserSelection = window.getSelection();
  const activeElement = document.activeElement;
  return {
    fallbackBlockId,
    editorFocused: editor.isFocused,
    tiptapFocused: editor.isFocused,
    tiptapDestroyed: editor.isDestroyed,
    tiptapSelectionType: tiptapSelection?.constructor?.name,
    tiptapSelectionFrom: tiptapSelection?.from,
    tiptapSelectionTo: tiptapSelection?.to,
    tiptapSelectionEmpty: tiptapSelection?.empty,
    browserSelectionType: browserSelection?.type,
    browserSelectionRangeCount: browserSelection?.rangeCount,
    activeElementTagName: activeElement?.tagName,
    activeElementRole: activeElement?.getAttribute('role') ?? undefined,
    activeElementDataId: activeElement?.getAttribute('data-id') ?? undefined,
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

// ============================================================================
// AI Assistant State
// ============================================================================

export interface AIAssistantState {
  isOpen: boolean;
  blockId: string;
  action?: string;
  position: { top: number; left: number };
  context: AIEditorContext;
}

export function useAIAssistant(editor: Editor | null, supportedNodeTypes?: TiptapAINodeTypes, enabled = true) {
  const [aiAssistant, setAiAssistant] = useState<AIAssistantState | null>(null);

  const openAIMenu = useCallback(
    (action?: string, fallbackBlockId?: string) => {
      if (!enabled) {
        return;
      }
      if (!editor) {
        aiLogger.warn('AI menu open requested without editor', { action, fallbackBlockId });
        return;
      }

      aiLogger.debug('AI menu open requested', {
        action,
        ...getEditorDiagnostics(editor, fallbackBlockId),
      });

      let context;
      try {
        context = resolveTiptapAIContext(editor, supportedNodeTypes);
      } catch (error) {
        aiLogger.error('AI context resolution failed before opening menu', {
          action,
          error: serializeError(error),
          ...getEditorDiagnostics(editor, fallbackBlockId),
        });
        return;
      }

      if (!context.isSupported || !context.currentBlockId) {
        aiLogger.warn('AI menu context is not openable', {
          action,
          currentBlockId: context.currentBlockId,
          isSupported: context.isSupported,
          selectedBlockCount: context.selectedBlockIds.length,
          mode: context.mode,
          ...getEditorDiagnostics(editor, fallbackBlockId),
        });
        return;
      }
      const blockId = context.currentBlockId;

      // Get cursor position for menu placement
      let position = { top: 100, left: 100 };

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          position = {
            top: rect.bottom + 8,
            left: rect.left,
          };
        }
      }

      // Fallback: find block element
      if (position.top === 100) {
        const blockElement = window.document.querySelector(`[data-id="${blockId}"]`);
        if (blockElement) {
          const rect = blockElement.getBoundingClientRect();
          position = {
            top: rect.bottom + 8,
            left: rect.left,
          };
        }
      }

      setAiAssistant({
        isOpen: true,
        blockId,
        action,
        position,
        context,
      });
      aiLogger.debug('AI menu state opened', {
        action,
        blockId,
        position,
        selectedBlockCount: context.selectedBlockIds.length,
        mode: context.mode,
      });
    },
    [editor, enabled, supportedNodeTypes],
  );

  const closeAIMenu = useCallback(() => {
    setAiAssistant(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      closeAIMenu();
    }
  }, [closeAIMenu, enabled]);

  useWindowEvent('keydown', (event) => {
    if (!enabled) {
      return;
    }
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    if (modifier && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      openAIMenu();
    }
  });

  return {
    aiAssistant,
    openAIMenu,
    closeAIMenu,
  };
}

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
      previewWidth: '100',
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
