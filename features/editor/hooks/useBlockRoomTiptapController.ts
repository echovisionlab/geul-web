'use client';

import { useMemo } from 'react';
import type * as Y from 'yjs';
import type { BlockRoomDocumentType } from '@/lib/collab/block-room-bootstrap';
import {
  createBlockRoomProseMirrorBridge,
  type BlockRoomProseMirrorBridge,
} from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import {
  createPostBlockRoomTiptapController,
  createRichTextBlockRoomTiptapController,
  type PostBlockRoomTiptapController,
  type RichTextBlockRoomTiptapController,
} from '@/features/editor/tiptap/block-room-tiptap-controller';

export type RichTextBlockRoomDocumentType = Exclude<BlockRoomDocumentType, 'page'>;

function useBlockRoomTiptapController<Controller>(
  documentType: RichTextBlockRoomDocumentType,
  document: Y.Doc | null,
  locale: string | null,
  createController: (bridge: BlockRoomProseMirrorBridge) => Controller,
): Controller | null {
  return useMemo(() => {
    if (!document || !locale) {
      return null;
    }
    return createController(
      createBlockRoomProseMirrorBridge({
        document,
        documentType,
        locale,
      }),
    );
  }, [createController, document, documentType, locale]);
}

export function useRichTextBlockRoomController(
  documentType: RichTextBlockRoomDocumentType,
  document: Y.Doc | null,
  locale: string | null,
): RichTextBlockRoomTiptapController | null {
  return useBlockRoomTiptapController(documentType, document, locale, createRichTextBlockRoomTiptapController);
}

export function usePostBlockRoomController(
  document: Y.Doc | null,
  locale: string | null,
): PostBlockRoomTiptapController | null {
  return useBlockRoomTiptapController('post', document, locale, createPostBlockRoomTiptapController);
}
