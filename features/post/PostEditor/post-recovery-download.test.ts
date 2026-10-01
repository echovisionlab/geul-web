// @vitest-environment jsdom

import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import { downloadPostRecoverySnapshot, serializePostRecoverySnapshot } from './post-recovery-download';

const entityId = '11111111-1111-4111-8111-111111111111';

function postDocument(locale = 'en'): LocalizedRichTextDocument {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale,
    base: { nodes: [] },
    localeOverlay: { locale, blocks: [] },
  });
}

function snapshot(): BlockRoomRecoverySnapshot {
  const yDocument = new Y.Doc();
  const canonicalDocument = postDocument();
  hydrateCanonicalBlockRoom(yDocument, 'post', 'en', canonicalDocument, []);
  const result: BlockRoomRecoverySnapshot = {
    documentType: 'post',
    entityId,
    locale: 'en',
    capturedAt: 1000,
    sourceLocale: 'en',
    canonicalDocument: materializeCanonicalBlockRoom(yDocument, 'post'),
    documentRevision: 'saved-revision',
    yjsUpdate: Y.encodeStateAsUpdate(yDocument),
  };
  yDocument.destroy();
  return result;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Post recovery download', () => {
  it('exports resident metadata with the captured room and a replayable Yjs snapshot', () => {
    const copy = JSON.parse(
      serializePostRecoverySnapshot(snapshot(), {
        title: 'Local title',
        summary: 'Local summary',
        commentsEnabled: false,
        mapPlaceId: 'place-1',
        layout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
      }),
    );

    expect(copy).toMatchObject({
      format: 'geul-post-recovery-v1',
      postId: entityId,
      locale: 'en',
      sourceLocale: 'en',
      localMetadata: {
        title: 'Local title',
        summary: 'Local summary',
        commentsEnabled: false,
        mapPlaceId: 'place-1',
        layout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
      },
      canonicalDocument: { locale: 'en' },
      localDocument: { locale: 'en' },
    });

    const replay = new Y.Doc();
    Y.applyUpdate(replay, Uint8Array.from(copy.yjsUpdate));
    expect(materializeCanonicalBlockRoom(replay, 'post').$typeName).toBe('api.content.v1.LocalizedRichTextDocument');
    replay.destroy();
  });

  it('preserves the raw recovery bytes when the local graph is incomplete', () => {
    const copy = snapshot();
    copy.yjsUpdate = Uint8Array.of(1, 2, 3);
    const recovered = JSON.parse(serializePostRecoverySnapshot(copy));
    expect(recovered.localDocument).toBeUndefined();
    expect(recovered.yjsUpdate).toEqual([1, 2, 3]);
  });

  it('rejects recovery data from another entity type or locale', () => {
    const copy = snapshot();
    expect(() => serializePostRecoverySnapshot({ ...copy, documentType: 'page' } as BlockRoomRecoverySnapshot)).toThrow(
      'Expected a Post recovery snapshot',
    );
    expect(() => serializePostRecoverySnapshot({ ...copy, canonicalDocument: postDocument('ko') })).toThrow(
      'Expected a Post recovery snapshot',
    );
  });

  it('downloads a Post and locale scoped JSON file and releases its temporary URL', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:recovery');
    const revokeObjectURL = vi.fn();
    const NativeURL = URL;
    vi.stubGlobal(
      'URL',
      class extends NativeURL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
      },
    );
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe(`post-${entityId}-en-recovery-1000.json`);
      expect(this.href).toBe('blob:recovery');
    });

    downloadPostRecoverySnapshot(snapshot());

    expect(clicked).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recovery');
  });
});
