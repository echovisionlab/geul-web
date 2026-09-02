'use client';

import { useRichTextBlockRoomController, type RichTextBlockRoomDocumentType } from './useBlockRoomTiptapController';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import { useBlockRoomConnection, type BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';

export interface RichTextBlockRoomEditor extends BlockRoomConnection {
  locale: string | null;
  controller: RichTextBlockRoomTiptapController | null;
}

export function useRichTextBlockRoomEditor(
  documentType: RichTextBlockRoomDocumentType,
  entityId: string,
  locale: string | null,
): RichTextBlockRoomEditor {
  const connection = useBlockRoomConnection(documentType, entityId, locale);
  const controller = useRichTextBlockRoomController(documentType, connection.doc, locale);
  return { ...connection, locale, controller };
}
