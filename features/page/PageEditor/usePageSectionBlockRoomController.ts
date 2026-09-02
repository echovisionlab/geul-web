'use client';

import { useMemo } from 'react';
import type * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import {
  createRichTextBlockRoomTiptapController,
  type RichTextBlockRoomTiptapController,
} from '@/features/editor/tiptap/block-room-tiptap-controller';

export function usePageSectionBlockRoomController(
  document: Y.Doc,
  locale: string,
  pageSectionId: string,
): RichTextBlockRoomTiptapController;
export function usePageSectionBlockRoomController(
  document: Y.Doc,
  locale: string,
  pageSectionId: string,
  enabled: boolean,
): RichTextBlockRoomTiptapController | null;
export function usePageSectionBlockRoomController(
  document: Y.Doc,
  locale: string,
  pageSectionId: string,
  enabled = true,
): RichTextBlockRoomTiptapController | null {
  return useMemo(() => {
    if (!enabled) {
      return null;
    }
    return createRichTextBlockRoomTiptapController(
      createBlockRoomProseMirrorBridge({
        document,
        documentType: 'page',
        locale,
        pageSectionId,
      }),
    );
  }, [document, enabled, locale, pageSectionId]);
}
