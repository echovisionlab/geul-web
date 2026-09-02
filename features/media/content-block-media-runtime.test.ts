import { create } from '@bufbuild/protobuf';
import {
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
  ContentBlockMediaItemSchema,
  MissingAttachmentMediaKind,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { describe, expect, it } from 'vitest';
import {
  ContentBlockMediaRuntimeIndex,
  parseContentBlockMediaItems,
  serializeContentBlockMediaItems,
} from './content-block-media-runtime';

const blockId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
const fileId = 'b67328c4-668c-5bf2-8f1e-41465149ded6';

function activeItem() {
  return create(ContentBlockMediaItemSchema, {
    selector: { blockId, referencePath: 'file' },
    attachment: { state: { case: 'activeFileId', value: fileId } },
    delivery: {
      fileId,
      fileName: 'field-notes',
      extension: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 2048n,
    },
    downloadAvailability: ContentBlockDownloadAvailability.AVAILABLE,
    downloadAction: ContentBlockDownloadAction.DOWNLOAD,
  });
}

describe('ContentBlockMediaRuntimeIndex', () => {
  it('indexes exact Block usage separately from File metadata', () => {
    const item = activeItem();
    const index = new ContentBlockMediaRuntimeIndex([item]);

    expect(index.get(blockId)).toBe(item);
    expect(index.filesById.get(fileId)?.fileName).toBe('field-notes');
    expect(index.get(blockId, 'shader.stages.0.channels.0.file')).toBeUndefined();
  });

  it('round-trips through protobuf JSON for client hydration without merging Block props', () => {
    const restored = parseContentBlockMediaItems(serializeContentBlockMediaItems([activeItem()]));

    expect(restored.get(blockId)?.delivery?.fileSize).toBe(2048n);
    expect(restored.get(blockId)?.attachment?.state).toEqual({ case: 'activeFileId', value: fileId });
  });

  it('keeps restore-only missing attachment state without inventing runtime delivery props', () => {
    const missing = create(ContentBlockMediaItemSchema, {
      selector: { blockId, referencePath: 'file' },
      attachment: {
        state: {
          case: 'missingAttachment',
          value: { formerFileId: fileId, mediaKind: MissingAttachmentMediaKind.IMAGE },
        },
      },
      downloadAvailability: ContentBlockDownloadAvailability.UNAVAILABLE,
      downloadAction: ContentBlockDownloadAction.NONE,
    });
    const index = new ContentBlockMediaRuntimeIndex([missing]);

    expect(index.get(blockId)?.attachment?.state.case).toBe('missingAttachment');
    expect(index.filesById.size).toBe(0);
  });

  it('fails closed on duplicate selectors, legacy IDs, or mismatched delivery identity', () => {
    const item = activeItem();
    expect(() => new ContentBlockMediaRuntimeIndex([item, item])).toThrow(/selector must be unique/u);
    expect(
      () =>
        new ContentBlockMediaRuntimeIndex([
          create(ContentBlockMediaItemSchema, {
            selector: { blockId: 'legacy-block', referencePath: 'file' },
            attachment: { state: { case: 'activeFileId', value: fileId } },
          }),
        ]),
    ).toThrow(/must be a UUID/u);
    expect(
      () =>
        new ContentBlockMediaRuntimeIndex([
          create(ContentBlockMediaItemSchema, {
            ...item,
            delivery: { ...item.delivery!, fileId: '8929fbc6-0a08-46f0-8fec-3dc7dbfaf784' },
          }),
        ]),
    ).toThrow(/does not match/u);
  });
});
