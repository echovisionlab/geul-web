'use client';

import type { Editor } from '@tiptap/core';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import type { AIEditorAssistantClient } from '@/lib/ai/editor-orchestration';
import { defaultTiptapAINodeTypes, type TiptapAINodeTypes } from './tiptap-ai';
import { TiptapAIAssistantSurface, useTiptapAIController } from './TiptapAIController';

export interface TiptapAIAssistantProps {
  editor: Editor;
  client: AIEditorAssistantClient;
  supportedNodeTypes?: TiptapAINodeTypes;
  target: AIDocumentTarget;
  /** Mirrors an owning permission state which may change before editor.setEditable runs. */
  editable?: boolean;
  allowGenerate?: boolean;
  onClose?: () => void;
}

/**
 * Mount beside a Tiptap editor.  It opens on Mod-J, snapshots the selection, and
 * closes if editing permission or that snapshot changes before an explicit apply.
 */
export function TiptapAIAssistant({
  editor,
  client,
  supportedNodeTypes = defaultTiptapAINodeTypes,
  target,
  editable = true,
  allowGenerate = true,
  onClose,
}: TiptapAIAssistantProps) {
  const controller = useTiptapAIController({ editor, supportedNodeTypes, editable, allowGenerate, onClose });
  return <TiptapAIAssistantSurface controller={controller} client={client} target={target} />;
}
