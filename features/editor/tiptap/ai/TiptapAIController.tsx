'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { AIAssistant } from '@/features/editor/AIMenu/AIMenu';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import type { AIEditorAssistantClient } from '@/lib/ai/editor-orchestration';
import {
  defaultTiptapAINodeTypes,
  resolveTiptapAIContext,
  type TiptapAIContext,
  type TiptapAINodeTypes,
} from './tiptap-ai';

interface TiptapAIControllerOptions {
  editor: Editor | null;
  supportedNodeTypes?: TiptapAINodeTypes;
  editable?: boolean;
  /** Locale-owned editors may modify selected text but cannot ask AI to create neutral structure. */
  allowGenerate?: boolean;
  onClose?: () => void;
}

/** Internal controller shared by keyboard, slash, and selection-menu entry points. */
export interface TiptapAIController {
  context: TiptapAIContext | null;
  close: () => void;
  open: (context?: TiptapAIContext) => boolean;
}

function contextMatchesEditor(editor: Editor, context: TiptapAIContext): boolean {
  const { selection } = editor.state;
  return (
    context.snapshot.doc === editor.state.doc &&
    context.snapshot.from === selection.from &&
    context.snapshot.to === selection.to
  );
}

export function useTiptapAIController({
  editor,
  supportedNodeTypes = defaultTiptapAINodeTypes,
  editable = true,
  allowGenerate = true,
  onClose,
}: TiptapAIControllerOptions): TiptapAIController {
  const [context, setContext] = useState<TiptapAIContext | null>(null);
  const contextRef = useRef<TiptapAIContext | null>(null);
  const close = useCallback(() => {
    contextRef.current = null;
    setContext(null);
    onClose?.();
  }, [onClose]);
  const open = useCallback(
    (requestedContext?: TiptapAIContext) => {
      if (!editor || editor.isDestroyed || !editable || !editor.isEditable) {
        return false;
      }
      const nextContext = requestedContext ?? resolveTiptapAIContext(editor, supportedNodeTypes);
      if (
        !nextContext.isSupported ||
        (!allowGenerate && nextContext.mode === 'generate') ||
        !contextMatchesEditor(editor, nextContext)
      ) {
        return false;
      }
      contextRef.current = nextContext;
      setContext(nextContext);
      return true;
    },
    [allowGenerate, editable, editor, supportedNodeTypes],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed || !editable || !editor.isEditable) {
      if (contextRef.current) {
        close();
      }
      return;
    }
    const closeWhenSnapshotChanges = () => {
      const active = contextRef.current;
      if (!active || contextMatchesEditor(editor, active)) {
        return;
      }
      close();
    };
    editor.on('transaction', closeWhenSnapshotChanges);
    editor.on('update', closeWhenSnapshotChanges);
    return () => {
      editor.off('transaction', closeWhenSnapshotChanges);
      editor.off('update', closeWhenSnapshotChanges);
    };
  }, [close, editable, editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    const openFromKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'j' && open()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const element = editor.view.dom;
    element.addEventListener('keydown', openFromKeyboard, true);
    return () => element.removeEventListener('keydown', openFromKeyboard, true);
  }, [editor, open]);

  return { close, context, open };
}

interface TiptapAIAssistantSurfaceProps {
  controller: TiptapAIController;
  client: AIEditorAssistantClient;
  target: AIDocumentTarget;
}

export function TiptapAIAssistantSurface({ controller, client, target }: TiptapAIAssistantSurfaceProps) {
  if (!controller.context) {
    return null;
  }
  return (
    <AIAssistant
      client={client}
      initialContext={controller.context}
      position={controller.context.menuPosition}
      onClose={controller.close}
      target={target}
    />
  );
}
