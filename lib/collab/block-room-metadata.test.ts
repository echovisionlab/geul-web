import { describe, expect, it, vi } from 'vitest';
import {
  updateBlockRoomDocumentMetadata,
  updateBlockRoomLocaleMetadata,
  updatePostBlockRoomDocumentMetadata,
} from '@/lib/collab/block-room-metadata';
import type { BlockRoomProtocolTransport } from '@/lib/collab/block-room-protocol';

function protocolTransport() {
  return {
    updateMetadata: vi.fn().mockResolvedValue({}),
    getSnapshot: vi.fn(),
  } satisfies BlockRoomProtocolTransport;
}

describe('block-room metadata updates', () => {
  it('does not send client-only type and locale routing fields in locale metadata', async () => {
    const protocol = protocolTransport();

    await updateBlockRoomLocaleMetadata(protocol, {
      type: 'program-event',
      locale: 'ko',
      title: '이벤트 제목',
      summary: null,
    });

    expect(protocol.updateMetadata).toHaveBeenCalledWith('locale', { title: '이벤트 제목', summary: null }, undefined);
  });

  it('keeps document metadata adapters unchanged', async () => {
    const protocol = protocolTransport();

    await updatePostBlockRoomDocumentMetadata(protocol, { categoryIds: ['category-id'] });
    await updateBlockRoomDocumentMetadata(protocol, {
      type: 'artist',
      realName: 'Artist Name',
    });

    expect(protocol.updateMetadata).toHaveBeenNthCalledWith(1, 'document', { categoryIds: ['category-id'] }, undefined);
    expect(protocol.updateMetadata).toHaveBeenNthCalledWith(2, 'document', { realName: 'Artist Name' }, undefined);
  });
});
