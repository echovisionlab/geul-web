import type { Editor } from '@tiptap/core';
import { replaceParagraphWithTiptapExternalVideo } from './tiptap/external-video';

export interface ExternalVideoLinkInput {
  url: string;
  label: string;
}

/**
 * Replaces one durable Paragraph block with its editor-only external-video
 * projection. The Block Room codec persists the same source link and block ID.
 */
export function replaceParagraphWithExternalVideoLink(
  editor: Editor,
  input: ExternalVideoLinkInput,
  fallbackBlockId?: string,
): boolean {
  return replaceParagraphWithTiptapExternalVideo(editor, input, fallbackBlockId);
}
