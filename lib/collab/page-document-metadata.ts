import { create, toJson } from '@bufbuild/protobuf';
import {
  DocumentContentHeight,
  DocumentLayoutSchema,
  DocumentRegionPlacement,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import type { DocumentLayout } from '@/features/document-layout';
import {
  BlockRoomProtocolError,
  type BlockRoomMetadataAck,
  type BlockRoomProtocolTransport,
} from '@/lib/collab/block-room-protocol';

export type PageDocumentMetadataAck = BlockRoomMetadataAck;

export class PageDocumentMetadataError extends Error {
  constructor(
    message: string,
    readonly reloadRequired: boolean,
  ) {
    super(message);
    this.name = 'PageDocumentMetadataError';
  }
}

function toProtoDocumentLayout(layout: DocumentLayout) {
  return create(DocumentLayoutSchema, {
    contentHeight: layout.contentHeight === 'viewport' ? DocumentContentHeight.VIEWPORT : DocumentContentHeight.CONTENT,
    pageChrome: layout.pageChrome === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
    footer: layout.footer === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
  });
}

export async function updatePageDocumentMetadata(
  protocol: BlockRoomProtocolTransport,
  documentLayout: DocumentLayout,
  signal?: AbortSignal,
): Promise<PageDocumentMetadataAck> {
  try {
    return await protocol.updateMetadata(
      'page_layout',
      {
        documentLayout: toJson(DocumentLayoutSchema, toProtoDocumentLayout(documentLayout)),
      },
      signal,
    );
  } catch (error) {
    if (error instanceof BlockRoomProtocolError) {
      throw new PageDocumentMetadataError(error.message, error.reloadRequired);
    }
    throw error;
  }
}
