import { describe, expect, it, vi } from 'vitest';
import { PageDocumentMetadataError, updatePageDocumentMetadata } from './page-document-metadata';
import { BlockRoomProtocolError } from './block-room-protocol';

describe('updatePageDocumentMetadata', () => {
  it('serializes the layout through the resident WebSocket protocol', async () => {
    const updateMetadata = vi.fn().mockResolvedValue({
      documentRevision: '11111111-1111-4111-8111-111111111111',
      changed: true,
      sourceChanged: false,
      changedLocales: [],
    });

    await expect(
      updatePageDocumentMetadata({ updateMetadata } as never, {
        contentHeight: 'viewport',
        pageChrome: 'pinned',
        footer: 'flow',
      }),
    ).resolves.toMatchObject({ changed: true });
    expect(updateMetadata).toHaveBeenCalledWith(
      'page_layout',
      {
        documentLayout: {
          contentHeight: 'DOCUMENT_CONTENT_HEIGHT_VIEWPORT',
          pageChrome: 'DOCUMENT_REGION_PLACEMENT_PINNED',
          footer: 'DOCUMENT_REGION_PLACEMENT_FLOW',
        },
      },
      undefined,
    );
  });

  it('preserves the reload-required boundary', async () => {
    const protocol = {
      updateMetadata: vi.fn().mockRejectedValue(new BlockRoomProtocolError('reload', true)),
    };
    const error = await updatePageDocumentMetadata(protocol as never, {
      contentHeight: 'content',
      pageChrome: 'flow',
      footer: 'flow',
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(PageDocumentMetadataError);
    expect(error).toMatchObject({ reloadRequired: true });
  });
});
