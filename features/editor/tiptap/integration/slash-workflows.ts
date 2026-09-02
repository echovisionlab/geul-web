import type { Editor } from '@tiptap/core';
import type { TiptapSlashActionContext, TiptapSlashWorkflowCallback } from '../slash/types';
import { applyTiptapSlashContent } from '../slash/execute';

/** Applies an immediate custom node in exactly one editor document mutation. */
export function createImmediateNodeWorkflow(
  editor: Editor,
  nodeName: 'p5Sketch' | 'threeScene' | 'shader',
): TiptapSlashWorkflowCallback {
  return (context) => {
    const nodeType = editor.schema.nodes[nodeName];
    if (!nodeType) {
      return false;
    }
    return applyTiptapSlashContent(editor, context, nodeType.create()) !== null;
  };
}

/** Opens an externally owned workflow without deleting or creating a placeholder. */
export function createDelegatedWorkflow(
  callback: ((context: TiptapSlashActionContext) => void) | undefined,
): TiptapSlashWorkflowCallback | undefined {
  return callback ? (context) => callback(context) : undefined;
}

/**
 * Preserves the file picker surface. The first argument remains the result
 * block ID; the optional context lets a success path validate and apply the
 * exact captured anchor without creating a cancel-time placeholder.
 */
export function createFileWorkflow(
  callback: ((blockId: string, context?: TiptapSlashActionContext) => void) | undefined,
): TiptapSlashWorkflowCallback | undefined {
  return callback ? (context) => callback(context.targetBlockId, context) : undefined;
}
