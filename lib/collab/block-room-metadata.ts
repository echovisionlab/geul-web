import {
  BlockRoomProtocolError,
  type BlockRoomMetadataAck,
  type BlockRoomProtocolTransport,
} from '@/lib/collab/block-room-protocol';

export type { BlockRoomMetadataAck };

export type BlockRoomLocaleMetadataUpdate =
  | { type: 'post'; locale: string; title?: string | null; summary?: string | null }
  | { type: 'page'; locale: string; title?: string; summary?: string | null }
  | { type: 'work'; locale: string; sourceTitle?: string; summary?: string | null }
  | { type: 'program-event'; locale: string; title?: string; summary?: string | null }
  | { type: 'artist' | 'label' | 'terms-history' | 'privacy-history'; locale: string; title?: string }
  | { type: 'release'; locale: string; title?: string; creditNotes?: readonly { creditId: string; note: string }[] }
  | { type: 'campaign' | 'email-template'; locale: string; subject?: string };

export type BlockRoomDocumentMetadataUpdate =
  | {
      type: 'artist';
      realName?: string | null;
      countryCode?: string | null;
      website?: string | null;
      socialLinks?: Readonly<Record<string, string>>;
      slug?: string | null;
      labelIds?: readonly string[];
      parentArtistId?: string | null;
    }
  | {
      type: 'label';
      slug?: string | null;
      countryCode?: string | null;
      website?: string | null;
      socialLinks?: Readonly<Record<string, string>>;
      parentLabelId?: string | null;
    };

export class BlockRoomMetadataError extends Error {
  constructor(
    message: string,
    readonly reloadRequired: boolean,
  ) {
    super(message);
    this.name = 'BlockRoomMetadataError';
  }
}

async function updateMetadata(
  protocol: BlockRoomProtocolTransport,
  operation: 'locale' | 'document',
  payload: unknown,
  signal?: AbortSignal,
): Promise<BlockRoomMetadataAck> {
  try {
    return await protocol.updateMetadata(operation, payload, signal);
  } catch (error) {
    if (error instanceof BlockRoomProtocolError) {
      throw new BlockRoomMetadataError(error.message, error.reloadRequired);
    }
    throw error;
  }
}

export function updateBlockRoomLocaleMetadata(
  protocol: BlockRoomProtocolTransport,
  update: BlockRoomLocaleMetadataUpdate,
  signal?: AbortSignal,
): Promise<BlockRoomMetadataAck> {
  const { type: _type, locale: _locale, ...metadata } = update;
  return updateMetadata(protocol, 'locale', metadata, signal);
}

export function updatePostBlockRoomDocumentMetadata(
  protocol: BlockRoomProtocolTransport,
  update: { categoryIds?: readonly string[]; tagIds?: readonly string[] },
  signal?: AbortSignal,
): Promise<BlockRoomMetadataAck> {
  return updateMetadata(protocol, 'document', update, signal);
}

export function updateBlockRoomDocumentMetadata(
  protocol: BlockRoomProtocolTransport,
  update: BlockRoomDocumentMetadataUpdate,
  signal?: AbortSignal,
): Promise<BlockRoomMetadataAck> {
  const { type: _type, ...metadata } = update;
  return updateMetadata(protocol, 'document', metadata, signal);
}
